const userModel = require("../models/user_model");
const generateToken = require("../utils/generateToken");
const bcrypt = require("bcrypt");
const redisClient = require("../config/redis");

// Cookie options — SameSite=None + Secure required for cross-origin (Vercel + Render)
const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  secure: isProduction, // HTTPS only in production
  sameSite: isProduction ? 'none' : 'lax', // cross-origin in prod, relaxed in dev
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

module.exports.register = async (req, res) => {
  try {
    // Check if req.body exists
    if (!req.body) {
      return res.status(400).json({
        error: "Request body is missing"
      });
    }

    let { fullName, yearBatch, role, email, password, routeNo, timing } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        error: "Full name, email and password are required",
      });
    }

    // Check if user already exists
    const existingUser = await userModel.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        error: "User already exists"
      });
    }

    // Hash the password using bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Save temporary signup data in Redis
    await redisClient.set(
      `signup:${email}`,
      JSON.stringify({
        fullName,
        yearBatch,
        routeNo,
        timing,
        role,
        email,
        password: hashedPassword,
      }),
      { EX: 600 } // 10 min
    );

    res.status(200).json({
      success: true,
      message: "Signup data stored. Verify OTP now.",
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

module.exports.login = async (req, res) => {
  try {
    let { email, password } = req.body;

    let user = await userModel.findOne({ email });

    if (!user) {
      return res.status(400).json({
        error: "Invalid credentials"
      });
    }

    // Comparing the password
    bcrypt.compare(password, user.password, function (err, result) {
      if (result) {
        let token = generateToken(user);

        res.cookie("token", token, cookieOptions);

        res.status(200).json({
          message: "Login successful",
          user: {
            _id: user._id,
            fullName: user.fullName,
            yearBatch: user.yearBatch,
            role: user.role,
            email: user.email
          }
        });

      } else {
        res.status(400).json({
          error: "Invalid credentials"
        });
      }
    });

  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      error: "An error occurred during login"
    });
  }
};

module.exports.logout = (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    return res.status(200).json({
      message: "Logged out successfully"
    });

  } catch (err) {
    return res.status(500).json({
      error: "Logout failed"
    });
  }
};