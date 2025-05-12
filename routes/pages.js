import express from "express";
import { ensureAuthenticated } from "../middleware/authMiddleware.js";
import { validateSessionIntegrity } from "../sessionIntegrity.js";
import { db } from "../db/connect.js";


const router = express.Router();

router.get("/", (req, res) => {
    res.render("index.ejs");
});

router.get("/submit", (req, res) => {
    res.render("submit.ejs");
});

router.post("/submit-recipe", ensureAuthenticated, validateSessionIntegrity, async (req, res) => {
    console.log(req.body);
    res.send("Recipe submitted.");
});

router.get("/browse", (req, res) => {
    res.render("browse.ejs");
});


router.get("/profile/:user_id", ensureAuthenticated, validateSessionIntegrity, async (req, res) => {
    const {user_id} = req.params;
    const findUser = {
        text: "SELECT * FROM users WHERE user_id = $1",
        values: [user_id]
    };
    const loadUser = await db.query(findUser);
    const user = loadUser.rows[0];
    if (!user) {
      return res.status(404).render("error.ejs", { message: "User not found." });
    }

    // Debug
    // console.log("Load user: ", user);
    
    res.render("user-profile.ejs", {user});
});


router.get("/about", (req, res) => {
    res.render("about.ejs");
});

export default router;
