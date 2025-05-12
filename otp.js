import express from "express";
import { db } from "../db/connect.js";
import crypto from "crypto";
import nodemailer from "nodemailer";

const router = express.Router();

// Render email input
router.get("/otp-login", (req, res) => {
  res.render("otp-login.ejs", { error: null });
});

// Handle email submission and send OTP
router.post("/otp-login", async (req, res) => {
  const { email } = req.body;

  try {
    const userResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) {
      return res.render("otp-login.ejs", { error: "No account with that email." });
    }

    const user = userResult.rows[0];
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry

    await db.query(
      "INSERT INTO otps (user_id, otp_code, otp_expires) VALUES ($1, $2, $3)",
      [user.user_id, otpCode, expiry]
    );

    // Send OTP via email
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
    });

    await transporter.sendMail({
      to: email,
      subject: "Your One-Time Password (OTP)",
      html: `<p>Your OTP is: <strong>${otpCode}</strong>. It expires in 5 minutes.</p>`,
    });

    res.redirect(`/verify-otp?uid=${user.user_id}`);

  } catch (err) {
    console.error("OTP Error:", err);
    res.render("otp-login.ejs", { error: "Something went wrong. Try again." });
  }
});

// Render OTP entry form
router.get("/verify-otp", (req, res) => {
  const uid = req.query.uid;
  res.render("otp-verify.ejs", { error: null, uid });
});

// Handle OTP submission
router.post("/verify-otp", async (req, res) => {
  const { uid, otp } = req.body;

  try {
    const result = await db.query(
      "SELECT * FROM otps WHERE user_id = $1 AND otp_code = $2 AND otp_expires > NOW() ORDER BY created_at DESC LIMIT 1",
      [uid, otp]
    );

    if (result.rows.length === 0) {
      return res.render("otp-verify.ejs", { error: "Invalid or expired OTP.", uid });
    }

    const userResult = await db.query("SELECT * FROM users WHERE user_id = $1", [uid]);
    const user = userResult.rows[0];

    // Clean up used OTP
    await db.query("DELETE FROM otps WHERE user_id = $1", [uid]);

    // Log user in via session
    req.session.regenerate(err => {
      if (err) throw err;
      req.session.user = {
        id: user.user_id,
        email: user.email,
        slug: user.slug
      };
      req.session.ua = req.get("User-Agent");
      req.session.ip = req.ip;
      res.redirect(`/profile/${user.slug}`);
    });

  } catch (err) {
    console.error("OTP verification error:", err);
    res.render("otp-verify.ejs", { error: "Something went wrong", uid });
  }
});

export default router;
