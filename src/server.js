
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Parse JSON requests
app.use(express.json({ limit: "10kb" }));

// Authentication rate limiter
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: {
        success: false,
        message: "Too many requests. Please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Health check route
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "VELoop Backend is running"
    });
});

// Authentication routes
app.use("/api/auth", authLimiter, require("./routes/authRoutes"));

// Wallet routes
app.use("/api/wallet", require("./routes/walletRoutes"));

// Withdrawal routes
app.use("/api/withdrawals", require("./routes/withdrawalRoutes"));

// API not found handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found"
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Server Error:", err);

    res.status(err.status || 500).json({
        success: false,
        message: "Internal server error"
    });
});

// Start server after database connection
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`VELoop Backend running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
};

startServer();
