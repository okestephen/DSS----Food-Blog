import express from "express";
import { db } from "../db/connect.js";
import bcrypt from "bcrypt";
import {cleanup, validateSignupInput } from "../utils/validation.js"

const router = express.Router();

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
            throw Error("Empty credentials supplied!");
        }

        const authenticateCredentials = {
            text: "SELECT * FROM users WHERE email = $1",
            values: [email]
        }

        const result = await db.query(authenticateCredentials);
        if (result.rows.length === 0) {
            throw new Error("User not found!");
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            throw new Error("Invalid credentials")
        }

        console.log("Welcome ", user.firstname, user.lastname)

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

        console.log(`fname: ${fname},\nlname: ${lname},\nemail: ${email},\npassword: ${password},\npasswordConf: ${passwordConf},\nphone: ${phone},\n`);

        // Validate INput
        validateSignupInput(fname, lname, email, password, passwordConf, phone)

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into database
        const registerUser = {
            text: "INSERT INTO users(firstname, lastname, password, email, phonenum) VALUES($1, $2, $3, $4, $5) RETURNING userid",
            values: [fname, lname, hashedPassword, email, phone],
        }

        const newEntry = await db.query(registerUser);
        console.log(`User created with ID: ${newEntry.rows[0].userid}`);

    } catch (error) {
        console.error("Error creating user: ", error);
        res.render("signup.ejs", {
            passwordConf: req.body.passwordConf,
            error: error.message 
        });
    }

});

export default router;