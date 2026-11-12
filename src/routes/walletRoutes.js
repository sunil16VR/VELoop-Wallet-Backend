
const express = require("express");
const router = express.Router();

// Import wallet controller functions
const {
    getWallet,
    getTransactions,
    simulateTransaction
} = require("../controllers/walletController");

// Import authentication middleware
const protect = require("../middleware/authMiddleware");

// Get the logged-in user's wallet
router.get("/", protect, getWallet);

// Get wallet transaction history
router.get("/transactions", protect, getTransactions);

// Simulate a wallet credit or debit (development/testing only)
router.post("/simulate", protect, simulateTransaction);

module.exports = router;
