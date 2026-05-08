const redisClient = require("../config/redis");
const generateOTP = require("../utils/generateOTP");
const sendOTP = require("../utils/sendOTP");
const userModel = require("../models/user_model");
const generateToken = require("../utils/generateToken");

const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const otp = generateOTP();

    await redisClient.set(`otp:${email}`, otp, {
      EX: 300,
    });

    await sendOTP(email, otp);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const storedOTP = await redisClient.get(`otp:${email}`);

    if (!storedOTP) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    if (storedOTP !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    const signupData = await redisClient.get(`signup:${email}`);

    if (!signupData) {
      return res.status(400).json({
        success: false,
        message: "Signup session expired",
      });
    }

    const parsed = JSON.parse(signupData);

    const {
      fullName,
      email: savedEmail,
      password,
      yearBatch,
      role,
      routeNo,
      timing,
    } = parsed;

    // Create user properly
    let newUser = await userModel.create({
      fullName,
      email: savedEmail,
      password,
      yearBatch,
      role,
      routeNo,
      timing,
    });

    let token = generateToken(newUser);

    res.cookie("token", token, cookieOptions);

    await redisClient.del(`otp:${email}`);
    await redisClient.del(`signup:${email}`);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        yearBatch: newUser.yearBatch,
        role: newUser.role,
        routeNo: newUser.routeNo,
        timing: newUser.timing,
        email: newUser.email,
      },
      token,
    });

  } catch (error) {
    console.error("OTP Verify Error:", error);

    res.status(500).json({
      success: false,
      error: "Registration failed",
    });
  }
};