import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
    res.render("index.ejs");
});

router.get("/submit", (req, res) => {
    res.render("submit.ejs");
});

router.post("/submit-recipe", (req, res) => {
    console.log(req.body);
    res.send("Recipe submitted.");
});

router.get("/browse", (req, res) => {
    res.render("browse.ejs");
});

router.get("/profile", (req, res) => {
    res.render("user-profile.ejs");
});

router.get("/about", (req, res) => {
    res.render("about.ejs");
});

export default router;
