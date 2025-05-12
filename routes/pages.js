import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
    res.render("index");     // will load views/index.ejs
});
 

router.get("/submit", (req, res) => {
    res.render("submit");    // will load views/submit.ejs
});
 

 

router.get("/profile", (req, res) => {
    res.render("user-profile"); // will load views/user-profile.ejs
});
 

router.get("/about", (req, res) => {
    res.render("about");     // will load views/about.ejs
});


export default router;
