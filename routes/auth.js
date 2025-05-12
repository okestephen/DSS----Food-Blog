import express from "express";
import { db } from "../db/connect.js";
import bcrypt from "bcrypt";
import {cleanup, validateSignupInput, delay, isValidPassword, passwordRequirementsMessage } from "../utils/validation.js";
import nodemailer from "nodemailer";
import crypto from "crypto";

// Pwned password check integration
import { isPwned } from "../utils/checkPwnedPassword.js";

const router = express.Router();


const OBSERVATION_WINDOW_MS = 10 * 60 * 1000;  // 10 minutes
const LOCKOUT_THRESHOLD = 3;
const MAX_ATTEMPTS = 6;  // Beyond this = permanent lock
const SALT = 10

// Render login page
router.get("/login", (req, res) => {
    const timeout = req.query.timeout;
    res.render("login.ejs", {error: null, timeout});
});
  
// Handle login submission
router.post("/login", async (req, res) => {
    try {
        let { email, password } = req.body;
        email = email.trim();
        password = password.trim();

        if (!email || !password) {
            await delay(500);
            throw Error("Empty credentials supplied!");
        }

        const authenticateCredentials = {
            text: "SELECT * FROM users WHERE email = $1",
            values: [email]
        }

        const result = await db.query(authenticateCredentials);
        if (result.rows.length === 0) {
            await delay(500);
            throw new Error("Login failed; Invalid email or password.");
        }

        const user = result.rows[0];

        if (user.is_locked) {
            const now = new Date();
            const lastFailed = new Date(user.last_failed || 0);
            const elapsed = now - lastFailed;

            if (user.failed_attempts >= MAX_ATTEMPTS) {
               throw new Error("Account is permanently locked. Please reset your password.");
            }

            // Within the observation window
            if (elapsed <= OBSERVATION_WINDOW_MS) {
               if (user.failed_attempts >= LOCKOUT_THRESHOLD) {
                  const exponentialDelay = Math.pow(2, user.failed_attempts - LOCKOUT_THRESHOLD) * 1000; // in ms
                  if (elapsed < exponentialDelay) {
                    const remaining = Math.ceil((exponentialDelay - elapsed) / 1000);
                    throw new Error(`Too many attempts. Try again in ${remaining} seconds.`);
                  }
                }
            } else {
               // Reset counter after window expires
               user.failed_attempts = 0;
            }
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            const updatedAttempts = user.failed_attempts + 1;
            const shouldLock = updatedAttempts >= MAX_ATTEMPTS;

            await db.query(
              "UPDATE users SET failed_attempts = $1, is_locked = $2, last_failed = NOW() WHERE email = $3",
              [updatedAttempts, shouldLock, email]
            );

            throw new Error(
              shouldLock
              ? "Account permanently locked. Please use 'Forgot Password' to reset access."
              : "Login failed; Invalid email or password."
            );

        }

        // Reset failed attempts ont successful login
        await db.query(
          "UPDATE users SET failed_attempts = 0, is_locked = false, last_failed = NULL WHERE email = $1",
           [email]
        );




        console.log("Welcome ", user.first_name, user.last_name)

        // TODO: Create a session or token here
        req.session.regenerate(err => {
            if (err) throw err;

            req.session.user = {
                id: user.user_id,
                email: user.email
            };
            req.session.ua = req.get("User-Agent");
            req.session.ip = req.ip;

            res.redirect(`/profile/${user.user_id}`)
        });

        // res.redirect(`/profile/${user.user_id}`);


    

    } catch (error) {
        console.error("Login error: ", error);
        res.render("login.ejs", {error: error.message});
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
        const hashedPassword = await bcrypt.hash(password, SALT);

        // Insert user into database
        const registerUser = {
            text: "INSERT INTO users(first_name, last_name, password, email, phone) VALUES($1, $2, $3, $4, $5) RETURNING user_id",
            values: [fname, lname, hashedPassword, email, phone],
        }

        const newEntry = await db.query(registerUser);
        console.log(`User created with ID: ${newEntry.rows[0].user_id}`);

        let locateUser = await db.query("SELECT * FROM users WHERE user_id = $1", [newEntry.rows[0].user_id]);
        let user = locateUser.rows[0]
        // console.log(locateUser)


        console.log("Welcome", user.first_name, user.last_name)

        // TODO: Create a session or token here
        req.session.regenerate(err => {   // Stop session fixation
            if (err) throw err;

            req.session.user = {
                id: user.user_id,
                email: user.email
            };

            // Block stolen sessions used elsewhere
            req.session.ua = req.get("User-Agent");
            req.session.ip = req.ip;

            res.redirect(`/profile/${user.user_id}`)
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
        const userResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userResult.rows.length === 0) {
            return res.render("forgot-password.ejs", { error: null, message: "If that email address is in our database, we will send you an email to reset your password."
});
        }

        const token = crypto.randomBytes(32).toString("hex");
        const expiry = new Date(Date.now() + (1000 * 60 * 60)); 

        await db.query(
            "UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3",
            [token, expiry, email]
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

        await transporter.sendMail({
            to: email,
            subject: "Password Reset",
            html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`,
        });


        res.render("forgot-password.ejs", { error: null, message: "If that email address is in our database, we will send you an email to reset your password."
});
    } catch (err) {
        console.error("Forgot password error: ", err);
        res.render("forgot-password.ejs", {error: "Something went wrong", message: null});
    }
});

router.get("/reset-password/:token", async (req, res) => {
    const { token } = req.params;
    const result = await db.query(
        "SELECT * FROM users WHERE reset_token = $1 AND reset_tokenOexpiry > NOW()",
        [token]
    );

    if (result.rows.length === 0) {
        return res.send("Invalid or expired token");
    }

    res.render("reset-password.ejs", { token, error: null});
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

    const hashedPassword = await bcrypt.hash(password.trim(), 10)

    await db.query(
        "UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE reset_token = $2",
        [hashedPassword, token]
    );

    res.redirect("/login?reset=success");
})



export default router;