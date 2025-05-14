import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send a One-Time Password (OTP) email to the user.
export async function sendOtpEmail(to, firstName, otpCode) {
  const html = `
    <p>Hello ${firstName},</p>
    <p>Your OTP is: <strong>${otpCode}</strong></p>
    <p>This code will expire in 5 minutes.</p>
  `;

  return transporter.sendMail({
    to,
    subject: "Your One-Time Password (OTP)",
    html
  });
}

// Send a password reset link email to the user.
export async function sendPasswordResetEmail(to, firstName, resetLink) {
  const html = `
    <p>Hello ${firstName},</p>
    <p>You requested to reset your password. Click the link below to proceed:</p>
    <a href="${resetLink}">${resetLink}</a>
    <p>If you didn’t request this, you can safely ignore this email.</p>
  `;

  return transporter.sendMail({
    to,
    subject: "Reset Your Password",
    html
  });
}

// Send a generic email (for custom usage).
export async function sendCustomEmail(options) {
  return transporter.sendMail(options);
}
