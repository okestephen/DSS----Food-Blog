import express from "express";
import "dotenv/config";
import { db } from "../db/connect.js";
import {cleanup, validateSignupInput, delay, isValidPassword, passwordRequirementsMessage } from "../utils/validation.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import slugify from "slugify";
import { isPwned } from "../utils/checkPwnedPassword.js";
import { encryptInfo, encrypt, decryptInfo, hashPassword, verifyPassword } from "../utils/crypto.js";
import { logOtpAction } from "../utils/logOtpAction.js";
import { sendPasswordResetEmail, sendOtpEmail } from "../utils/mailerService.js";


const router = express.Router();


const OBSERVATION_WINDOW_MS = 10 * 60 * 1000;  // 10 minutes
const LOCKOUT_THRESHOLD = 3;
const MAX_ATTEMPTS = 6;  // Beyond this = permanent lock

if (!process.env.ENCRYPTION_KEY) {
  throw new Error("Missing ENCRYPTION_KEY in environment variables.");
}
const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY, "hex");

// Render login page
router.get("/login", (req, res) => {
    const timeout = req.query.timeout;
    res.render("login.ejs", {error: null, timeout, step: "credentials", email: null});
});
  
// Handle login submission
router.post("/login", async (req, res) => {
  let { email, password, otp, step, resend } = req.body;

  try {
    await db.query("DELETE FROM otps WHERE otp_expires < NOW()"); // Clean up expired OTPs

    if (step === "otp") {
      const pendingUser = req.session.pendingUser;

      if(!pendingUser){
        return res.render("login.ejs", {
          error: "Invalid OTP or session expired.",
          step: "credentials",
          email
        });
      }

      const result = await db.query("SELECT * FROM users WHERE user_id = $1", [pendingUser.id]);

      if (result.rows.length === 0){
        return res.render("login.ejs", {
          error: "Invalid OTP or session expired.",
          step: "credentials",
          email
        });
      }

      const user = {...result.rows[0], decrypted: pendingUser.decrypted};

      if (resend === "true") {
        // Rate-limit resend
        const recentOtp = await db.query(
          "SELECT created_at FROM otps WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
          [user.user_id]
        );

        if (recentOtp.rows.length > 0) {
          const lastSent = new Date(recentOtp.rows[0].created_at);
          const secondsSinceLast = (Date.now() - lastSent.getTime()) / 1000;
          if (secondsSinceLast < 60) {
            return res.render("login.ejs", {
              email,
              step: "otp",
              error: `Please wait ${Math.ceil(60 - secondsSinceLast)} seconds before resending.`
            });
          }
        }

        const otpCode = crypto.randomInt(100000, 999999).toString();
        const expiry = new Date(Date.now() + 5 * 60 * 1000);

        const hashedOtp = await bcrypt.hash(otpCode, 10);

        await db.query(
          "INSERT INTO otps (user_id, otp_code, otp_expires) VALUES ($1, $2, $3)",
          [user.user_id, hashedOtp, expiry]
        );

        await logOtpAction(db, user.user_id, "resend", req);

        const transporter = nodemailer.createTransport({
          service: "Gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });

        await sendOtpEmail(user.decrypted.email, user.decrypted.firstname, otpCode);



        return res.render("login.ejs", {
          email,
          step: "otp",
          message: "New OTP sent. Please check your email."
        });
      }

      // Verify OTP
      const otpResult = await db.query(
        "SELECT * FROM otps WHERE user_id = $1 AND otp_expires > NOW() ORDER BY created_at DESC LIMIT 1",
        [user.user_id]
      );

      if (otpResult.rows.length === 0){
        await logOtpAction(db, user.user_id, "failed", req);
        await delay(500);
        return res.render("login.ejs", {
            error: "Invalid OTP or session expired.",
            step: "otp",
            email
        });
      }

      const isOtpValid = await bcrypt.compare(otp, otpResult.rows[0].otp_code);
      if (!isOtpValid) {
        await logOtpAction(db, user.user_id, "failed", req);
        await delay(500);
        return res.render("login.ejs", {
          error: "Invalid OTP or session expired.", 
          step: "otp",
          email
        });
      }

      await logOtpAction(db, user.user_id, "success", req);

      // Clean up OTP
      await db.query("DELETE FROM otps WHERE user_id = $1", [user.user_id]);

      // Create session
      return req.session.regenerate(err => {
        if (err) throw err;
        req.session.user = {
          id: user.user_id,
          email: user.decrypted.email,
          slug: user.slug,
          firstname: user.decrypted.firstname,
          lastname: user.decrypted.lastname
        };
        req.session.ua = req.get("User-Agent");
        req.session.ip = req.ip; 
        delete req.session.pendingUser;  // Clear pending state
        res.redirect(`/profile/${user.slug}`);
      });
    }

    // Step 1: Check email and password
    // password = password.trim();

    if (!email || !password) {
      await delay(500);
      throw new Error("Email and password are required.");
    }

    const allUsers = await db.query("SELECT * FROM users"); // We need to decrypt each one to match email

    let matchedUser = null;
    for (const row of allUsers.rows) {
        try {
            const decrypted = decryptInfo({
                firstname: row.first_name,
                lastname: row.last_name,
                email: row.email,
                phone: row.phone
            }, encryptionKey);

            if (decrypted.email == email.trim()) {
                matchedUser = { ...row, decrypted };
                console.log(matchedUser);
                break;
            }
        } catch (err) {
            console.error("Decryption failed for user row:", err.message);
        }
    }

    if (!matchedUser) {
        await delay(500);
        throw new Error("Login failed; Invalid email or password.");
    }

    const user = matchedUser;

    // Account lockout checks
    if (user.is_locked) {
      const now = new Date();
      const lastFailed = new Date(user.last_failed || 0);
      const elapsed = now - lastFailed;

      if (user.failed_attempts >= MAX_ATTEMPTS) {
        throw new Error("Login attempt has been permanently locked. Please reset your password.");
      }

      if (elapsed <= OBSERVATION_WINDOW_MS && user.failed_attempts >= LOCKOUT_THRESHOLD) {
        const delayTime = Math.pow(2, user.failed_attempts - LOCKOUT_THRESHOLD) * 1000;
        if (elapsed < delayTime) {
          const remaining = Math.ceil((delayTime - elapsed) / 1000);
          throw new Error(`Too many attempts. Try again in ${remaining} seconds.`);
        }
      } else {
        await db.query("UPDATE users SET failed_attempts = 0 WHERE user_id = $1", [user.user_id]);
      }
    }

    const validPassword = await verifyPassword(password.trim(), user.password);
    if (!validPassword) {
      const updatedAttempts = user.failed_attempts + 1;
      const shouldLock = updatedAttempts >= MAX_ATTEMPTS;

      await db.query(
        "UPDATE users SET failed_attempts = $1, is_locked = $2, last_failed = NOW() WHERE user_id = $3",
        [updatedAttempts, shouldLock, user.user_id]
      );

      throw new Error(
        shouldLock
          ? "Account permanently locked. Please user 'Forgot Password' to reset access." 
          : "Login failed; Invalid email or password."
      );
    }

    await db.query(
      "UPDATE users SET failed_attempts = 0, is_locked = false, last_failed = NULL WHERE user_id = $1",
      [user.user_id]
    );

    // Store pending user info for OTP step
    req.session.pendingUser = {
      id: user.user_id,
      slug: user.slug,
      decrypted: user.decrypted
    }

    // Generate and Send OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);  // 5 min Expiry

    const hashedOtp = await bcrypt.hash(otpCode, 10);

    await db.query(
      "INSERT INTO otps (user_id, otp_code, otp_expires) VALUES ($1, $2, $3)",
      [user.user_id, hashedOtp, expiry]
    );

    await logOtpAction(db, user.user_id, "generated", req);

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await sendOtpEmail(user.decrypted.email, user.decrypted.firstname, otpCode);

    return res.render("login.ejs", {
      step: "otp",
      email,
      error: null
    });
  } catch (error) {
    console.error("Login error: ", error);
    res.render("login.ejs", {
      error: error.message,
      step: step === "otp" ? "otp" : "credentials",
      email
    });
  }
});

// Render sign up page
router.get("/signup", (req, res) => {
    res.render("signup.ejs", { passwordConf: null , error: null});
});


// Handle signup submission
router.post("/signup", async (req, res) => {
    try {
        let {fname, lname, email, password, passwordConf, phone} = req.body

        //Clean and normalise inputs
        fname = cleanup(fname);
        lname = cleanup(lname)
        email = email.trim()
        password = password.trim()
        passwordConf = passwordConf.trim()
        phone = phone && phone.trim() !== "" ? phone.trim() : null;

        // Debug
        // console.log(`fname: ${fname},\nlname: ${lname},\nemail: ${email},\npassword: ${password},\npasswordConf: ${passwordConf},\nphone: ${phone},\n`);

        // Validate Input
        validateSignupInput(fname, lname, email, password, passwordConf, phone)

        
        if (await isPwned(password)) {
           throw new Error("This password has been found in known data breaches. Please choose a different one.");
        }


        // Check for existing user
        const checkExisting = {
            text: "SELECT * FROM users WHERE email = $1",
            values: [email]
        }

        const result = await db.query(checkExisting);
        if (result.rows.length !== 0) {
            throw new Error("Invalid Email Address");
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Generate Slug
        const baseSlug = slugify(`${fname}-${lname}`, { lower: true });
        const uniqueSlug = `${baseSlug}-${Date.now()}`;

        // Get encryption key
        const encrypted = encryptInfo(fname, lname, email, phone, encryptionKey);


        // Insert user into database
        const registerUser = await db.query(
            "INSERT INTO users(first_name, last_name, password, email, phone, slug) VALUES($1, $2, $3, $4, $5, $6) RETURNING *",
            [encrypted.firstname, encrypted.lastname, hashedPassword, encrypted.email, encrypted.phone, uniqueSlug]
        );


        const user = registerUser.rows[0]

        console.log(`User created with slug: ${user.slug}`);
        console.log("Welcome", user.decrypted.firstname, user.decrypted.lastname)

        // TODO: Create a session or token here
        return req.session.regenerate(err => {   // Stop session fixation
            if (err) throw err;

            req.session.user = {
                id: user.user_id,
                email: user.decrypted.email,
                slug: user.slug,
            };

            // Block stolen sessions used elsewhere
            req.session.ua = req.get("User-Agent");
            req.session.ip = req.ip;

            res.redirect(`/profile/${user.slug}`)
        });
        

    } catch (error) {
        console.error("Error creating user: ", error);
        res.render("signup.ejs", {
            error: error.message,
        });
    }

});


router.post("/logout", (req, res) => {   // Proper Session Invalidation
    req.session.destroy(err => {
        if (err) {
            console.error("Logout error: ", err);
            return res.redirect("/profile");
        }
        res.clearCookie("connect.sid");
        res.redirect("/login");
    });
});

router.get("/forgot-password", (req, res) => {
    res.render("forgot-password.ejs", {error: null, message: null});
});

router.post("/forgot-password", async (req, res) => {
    const {email} = req.body;
    try {
        const allUsers = await db.query("SELECT * FROM users");
        let matchedUser = null;

        for (const row of allUsers.rows) {
          try {
            const decrypted = decryptInfo({
              firstname: row.first_name,
              lastname: row.last_name,
              email: row.email,
              phone: row.phone
            }, Buffer.from(process.env.ENCRYPTION_KEY, "hex"));

            if (decrypted.email === email.trim()) {
              matchedUser = { ...row, decrypted };
              break;
            }
          } catch (err) {
            console.error("Decrytion error for a user:", err.message);
          }
        }

        if (!matchedUser){
          return res.render("forgot-password.ejs", {
            error: null,
            message: "If that email address is in our database, we will send you an email to reset your password."
          });
        }

        const user = matchedUser;
        const token = crypto.randomBytes(32).toString("hex");
        const expiry = new Date(Date.now() + (1000 * 60 * 60)); 

        await db.query(
            "UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE user_id = $3",
            [token, expiry, user.user_id]
        );

        // Send email
        const resetLink = `http://localhost:3000/reset-password/${token}`;

        // Setyp transport
        const transporter = nodemailer.createTransport({
            service: "Gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
        });
        
        await sendPasswordResetEmail(user.decrypted.email, user.decrypted.firstname, resetLink);
        
        res.render("forgot-password.ejs", { 
          error: null,
          message: "If that email address is in our database, we will send you an email to reset your password."
        });

    } catch (err) {
        console.error("Forgot password error: ", err);
        res.render("forgot-password.ejs", {
          error: "Something went wrong",
          message: null
        });
    }
});

router.get("/reset-password/:token", async (req, res) => {
    const { token } = req.params;
    const result = await db.query(
        "SELECT * FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()",
        [token]
    );

    if (result.rows.length === 0) {
        return res.send("Invalid or expired token");
    }

    const user = result.rows[0];
    let firstname = null;

    try {
      const decrypted = decryptInfo({
        firstname: user.first_name,
        lastname: user.last_name,
        email: user.email,
        phone: user.phone
      }, Buffer.from(process.env.ENCRYPTION_KEY, 'hex'));
      firstname = decrypted.firstname;
    } catch (err) {
      console.error("Decryption error:", err.message);
    }

  res.render("reset-password.ejs", { token, error: null, firstname });   
});

router.post("/reset-password/:token", async (req, res) => {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword){
        return res.render("reset-password.ejs", {token, error: "Passwords do not match."});
    }
    const userResult = await db.query(
        "SELECT * FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()", 
        [token]
    );
    if (userResult.rows.length === 0) {
        return res.send("Invalid or expired token")
    }

    if (!isValidPassword(password)){
        return res.render("reset-password.ejs", {
            token,
            error: passwordRequirementsMessage()
        });
    }

    if (await isPwned(password)) {
        return res.render("/reset-password.ejs", {
            token,
            error: "This password has been found in known data breaches. Please choose a different one."
        });
    }

    const hashedPassword = await hashPassword(password);

    await db.query(
        "UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE reset_token = $2",
        [hashedPassword, token]
    );

    res.redirect("/login?reset=success");
})



export default router;