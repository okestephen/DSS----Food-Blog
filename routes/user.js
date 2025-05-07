import express from "express";
const router = express.Router();
import { db } from "../db/connect.js";

router.get("/profile/:user_id", async (req, res) => {
    const {user_id} = req.params;
    const findUser = {
        text: "SELECT * FROM users WHERE user_id = $1",
        values: [user_id]
    };
    const loadUser = await db.query(findUser);
    const user = loadUser.rows[0];
    // Debug
    // console.log("Load user: ", user);
    
    res.render("user-profile.ejs", {user});
});


export default router;

