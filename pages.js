import express from "express";
import { ensureAuthenticated } from "../middleware/authMiddleware.js";
import { validateSessionIntegrity } from "../middleware/sessionIntegrity.js";
import { db } from "../db/connect.js";


const router = express.Router();

router.get("/", (req, res) => {
    res.render("index");     // will load views/index.ejs
});
 

router.get("/submit", (req, res) => {
    res.render("submit");    // will load views/submit.ejs
});

router.post("/submit-recipe", ensureAuthenticated, validateSessionIntegrity, async (req, res) => {
    console.log(req.body);
    res.send("Recipe submitted.");
});

router.get("/browse", (req, res) => {
    res.render("browse.ejs");
});


router.get("/profile/:slug", ensureAuthenticated, validateSessionIntegrity, async (req, res) => {
    const {slug} = req.params;
    const result = await db.query(
        "SELECT * FROM users WHERE slug = $1",
        [slug]
    );

    if (result.rows.length === 0){
        return res.status(404).send("User not found")
    }

    const user = result.rows[0];

    // Block acess if slug isn't for logged-in user
    if (user.user_id !== req.session.user.id){
        res.status(403).send("Access Denied");
    }
    
    res.render("user-profile.ejs", {user});
});


router.get("/about", (req, res) => {
    res.render("about");     // will load views/about.ejs
});


export default router;
