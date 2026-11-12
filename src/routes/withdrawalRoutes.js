
const express = require("express");
const router = express.Router();

const {
    createWithdrawal,
    getWithdrawals
} = require("../controllers/withdrawalController");

const protect = require("../middleware/authMiddleware");

// Create a withdrawal request
router.post("/", protect, createWithdrawal);

// Get withdrawal history
router.get("/", protect, getWithdrawals);

module.exports = router;
