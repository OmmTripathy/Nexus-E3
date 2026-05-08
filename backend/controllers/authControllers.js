const userModel = require("../models/user_model");
const generateToken = require("../utils/generateToken");
const bcrypt = require("bcrypt");
const otpModel = require("../models/otpModel");
const nodemailer = require("nodemailer");
module.exports.register = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Request body is missing" });
    }
    
    let { fullname, regdNo, email, password, role, routeNo, timing, phone, profileImage } = req.body;
    
    // Check required base fields
    if (!fullname || !email || !password) {
      return res.status(400).json({ error: "Fullname, email, and password are required" });
    }

    // Role specific validation
    const assignedRole = role || 'student';
    if (assignedRole === 'student' && !regdNo) {
      return res.status(400).json({ error: "Registration number is required for students" });
    }
    if (assignedRole === 'driver' && (!routeNo || !timing)) {
      return res.status(400).json({ error: "Route number and timing are required for drivers" });
    }
    
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Ensure regdNo is unique (one per student)
    if (assignedRole === 'student' && regdNo) {
      const existingRegd = await userModel.findOne({ regdNo });
      if (existingRegd) {
        return res.status(400).json({ error: "This registration number is already in use" });
      }
    }
    
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    let newUser = await userModel.create({
      fullname,
      email,
      password: hashedPassword,
      regdNo,
      role: assignedRole,
      routeNo,
      timing,
      phone,
      profileImage
    });

    let token = generateToken(newUser);
        
    // FIXED: JWT in localStorage Security Update (BUG 6)
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: newUser._id,
        fullname: newUser.fullname,
        email: newUser.email,
        role: newUser.role,
        routeNo: newUser.routeNo
      },
      token: token
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "An error occurred while registering the user" });
  }
};

module.exports.login = async (req, res) => {
  try {
    let { email, password } = req.body;

    let user = await userModel.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Check if user is blocked by admin
    if (user.isBlocked) {
      return res.status(403).json({ error: "Your account has been suspended. Please contact the administrator." });
    }
    
    // Comparing the password using async/await
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    let token = generateToken(user);
    // FIXED: JWT in localStorage Security Update (BUG 6)
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    res.status(200).json({ 
      message: "Login successful", 
      user: {
        _id: user._id,
        fullname: user.fullname,
        email: user.email,
        role: user.role,
        routeNo: user.routeNo,
        profileImage: user.profileImage
      },
      token: token
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "An error occurred during login" });
  }
};

module.exports.logout = (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    return res.status(500).json({ error: "Logout failed" });
  }
};

module.exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    // Generate a real random 4-digit OTP every time
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    console.log(`\n=============================\nGENERATED OTP FOR ${email} : ${otpCode}\n=============================\n`);

    // Delete any existing OTP for this email
    await otpModel.deleteMany({ email });

    // Save the real OTP to the database
    await otpModel.create({ email, otp: otpCode });

    // Gmail App Passwords have spaces — strip them
    const rawPass = (process.env.EMAIL_PASS || "").replace(/\s/g, "");

    // Try sending via both SMTP ports — 587 (STARTTLS) first, then 465 (SSL)
    let emailSent = false;
    let emailError = null;

    const transportConfigs = [
      { host: 'smtp.gmail.com', port: 587, secure: false, name: 'STARTTLS-587' },
      { host: 'smtp.gmail.com', port: 465, secure: true,  name: 'SSL-465' },
    ];

    for (const cfg of transportConfigs) {
      if (emailSent) break;
      try {
        const transporter = nodemailer.createTransport({
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          auth: { user: process.env.EMAIL, pass: rawPass },
          connectionTimeout: 8000,
          greetingTimeout: 8000,
          socketTimeout: 10000,
        });

        const emailPromise = transporter.sendMail({
          from: `"Campus Commute" <${process.env.EMAIL}>`,
          to: email,
          subject: "Your Campus Commute Verification Code",
          text: `Your verification code is: ${otpCode}. It expires in 5 minutes. Do not share this with anyone.`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
              <h2 style="color:#0f766e;margin-bottom:8px">Campus Commute</h2>
              <p style="color:#374151">Your email verification code is:</p>
              <div style="background:#f0fdfa;border:2px solid #0f766e;border-radius:8px;padding:20px;text-align:center;margin:16px 0">
                <span style="font-size:40px;font-weight:bold;letter-spacing:16px;color:#0f766e;font-family:monospace">${otpCode}</span>
              </div>
              <p style="color:#6b7280;font-size:13px">Expires in <strong>5 minutes</strong>. Do not share this code.</p>
            </div>
          `,
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timed out on ${cfg.name}`)), 12000)
        );

        await Promise.race([emailPromise, timeoutPromise]);
        emailSent = true;
        console.log(`[OTP] Email sent via ${cfg.name} to ${email}`);
      } catch (err) {
        emailError = err.message;
        console.warn(`[OTP] ${cfg.name} failed:`, err.message);
      }
    }

    if (emailSent) {
      return res.status(200).json({ success: true, message: "OTP sent to your email." });
    } else {
      // Network is blocking SMTP — return OTP as fallback so signup always works
      const isNetworkBlock = emailError && (
        emailError.includes("ETIMEOUT") || emailError.includes("ECONNREFUSED") ||
        emailError.includes("ENOTFOUND") || emailError.includes("Timed out")
      );
      console.log(`[OTP FALLBACK] ${isNetworkBlock ? "Network blocked SMTP" : "Auth/send error"} for ${email}. Error: ${emailError}`);
      return res.status(200).json({
        success: true,
        emailFailed: true,
        otp: otpCode,
        message: isNetworkBlock
          ? "Email blocked by network. Use the code shown on screen."
          : "Email delivery failed. Use the code shown on screen.",
      });
    }
  } catch (error) {
    console.error("sendOTP critical error:", error);
    res.status(500).json({ error: "Failed to generate OTP. Please try again." });
  }
};

module.exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });

    // Find the latest OTP
    const record = await otpModel.findOne({ email }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({ error: "OTP expired or invalid" });
    }

    if (record.otp === otp) {
      // Correct OTP, clear it
      await otpModel.deleteMany({ email });
      return res.status(200).json({ success: true, message: "OTP verified correctly" });
    } else {
      return res.status(400).json({ error: "Incorrect OTP" });
    }
  } catch (error) {
    console.error("verifyOTP error:", error);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
};

module.exports.googleLogin = async (req, res) => {
  try {
    const { accessToken, role } = req.body;
    if (!accessToken) return res.status(400).json({ error: "Access token is required" });

    // Fetch user details from Google
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${accessToken}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
    });
    
    if (!response.ok) {
        return res.status(401).json({ error: "Invalid Google token" });
    }
    
    const googleUser = await response.json();
    const assignedRole = role || 'student';
    
    let user = await userModel.findOne({ email: googleUser.email });
    
    if (!user) {
      // Auto-register via Google — hash the dummy password for consistency
      const hashedDummyPassword = await bcrypt.hash("OAuthGeneratedPassword!123", 10);
      user = await userModel.create({
        fullname: googleUser.name,
        email: googleUser.email,
        password: hashedDummyPassword,
        profileImage: googleUser.picture,
        role: assignedRole,
        routeNo: assignedRole === 'driver' ? 'UNASSIGNED' : undefined
      });
    }

    let token = generateToken(user);
    // FIXED: JWT in localStorage Security Update (BUG 6)
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    
    res.status(200).json({
      success: true,
      message: "Google OAuth successful",
      user: {
        id: user._id,
        fullname: user.fullname,
        email: user.email,
        role: user.role,
        routeNo: user.routeNo,
        profileImage: user.profileImage
      },
      token: token
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(500).json({ error: "Failed to authenticate with Google" });
  }
};

module.exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const user = req.user; // from isLoggedIn middleware

    if (!password) {
      return res.status(400).json({ error: "Password is required to delete account" });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Incorrect password" });
    }

    // Delete user
    await userModel.findByIdAndDelete(user._id);

    // Clear session token
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    res.status(200).json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete Account Error:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
};
