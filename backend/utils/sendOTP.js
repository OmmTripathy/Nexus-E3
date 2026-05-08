const nodemailer = require("nodemailer");

const sendOTP = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL,
    to: email,
    subject: "Campus Commute",
    text: `Use the verification code to continue securely: ${otp}
    
This code is valid for 5 minutes.

For your security, never share this OTP with anyone.

- Team Campus Commute`,
  });
};

module.exports = sendOTP;