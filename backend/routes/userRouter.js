const express = require("express");
const router = express.Router();
const {register, login, logout} = require('../controllers/authControllers');
// const cookieParser = require("cookie-parser");
router.use(express.json());

router.get("/", (req, res) => {
  res.send("User route is working");
});

// user routes
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

module.exports = router;