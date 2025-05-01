import express from "express";
import { db } from "../db/connect.js";
import bcrypt from "bcrypt";
import {cleanup, validateSignupInput, delay } from "../utils/validation.js"
import "dotenv/config"

const router = express.Router();
const LOCK_DURATION_MS = 10 * 60 * 1000;
const SALT = 10

// Render login page
router.get("/login", (req, res) => {
    res.render("login.ejs");
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
            throw new Error("Invalid credentials");
        }

        const user = result.rows[0];

        if (user.is_locked) {
            const lastFailed = new Date(user.last_failed || 0);
            const now = new Date();
            const elapsed = now - lastFailed;

            if (elapsed < LOCK_DURATION_MS) {
                await delay(500);
                throw new Error("Account is temporarily locked. Please try again later.");
            } else {
                // unlock afterduration
                const unlockUser = {
                    text:  "UPDATE users SET is_locked = false, failed_attempts = 0 WHERE email = $1",
                    values: [email]
                }

                await db.query(unlockUser);
                user.failed_attempts = 0;
            }
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            await delay(500);
            const updatedAttempts = user.failed_attempts + 1
            const shouldLock = updatedAttempts >= 5;

            const denyUser = {
                text: "UPDATE users SET failed_attempts = $1, is_locked = $2, last_failed = NOW() WHERE email = $3",
                values: [updatedAttempts, shouldLock, email]
            }
            // Denylist user
            await db.query(denyUser);

            throw new Error( 
                shouldLock ? "Account locked due to multiple failed attempts." : "Invalid credentials"
            );
        }

        // Reset failed attempts ont successful login
        const resetFailed = {
            text: "UPDATE users SET failed_attempts = 0, is_locked = false WHERE email = $1",
            values: [email]
        };

        await db.query(resetFailed);



        console.log("Welcome ", user.first_name, user.last_name)

        // TODO: Create a session or token here
        res.redirect("/profile");

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

        // Check for existing user
        const checkExisting = {
            text: "SELECT * FROM users WHERE email = $1",
            values: [email]
        }

        const result = await db.query(checkExisting);
        if (result.rows.length !== 0) {
            throw new Error("Email Addresss already exists");
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
        

        
        console.log("Welcome ", user.first_name, user.last_name)

        // TODO: Create a session or token here
        res.redirect("/profile");
        

    } catch (error) {
        console.error("Error creating user: ", error);
        res.render("signup.ejs", {
            passwordConf: req.body.passwordConf,
            error: error.message,
        });
    }

});

export default router;