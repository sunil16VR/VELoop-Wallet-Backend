
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const runInTransaction = require("../utils/transaction");
const jwt = require("jsonwebtoken");

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
};

// USER REGISTRATION
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters"
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured");
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email is already registered"
            });
        }

        // Create user and wallet together
        const result = await runInTransaction(async (session) => {
            const [user] = await User.create(
                [{
                    name: name.trim(),
                    email: normalizedEmail,
                    password
                }],
                { session }
            );

            const [wallet] = await Wallet.create(
                [{
                    user: user._id,
                    availableBalancePaise: 0,
                    pendingBalancePaise: 0
                }],
                { session }
            );

            return { user, wallet };
        });

        const token = generateToken(result.user._id);

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            token,
            user: {
                id: result.user._id,
                name: result.user.name,
                email: result.user.email,
                role: result.user.role
            },
            wallet: {
                availableBalancePaise:
                    result.wallet.availableBalancePaise,
                pendingBalancePaise:
                    result.wallet.pendingBalancePaise,
                currency: result.wallet.currency
            }
        });

    } catch (error) {
        console.error("Registration Error:", error.message);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Email is already registered"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Registration failed. Please try again."
        });
    }
};

// USER LOGIN
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured");
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Find user and retrieve hashed password
        const user = await User.findOne({
            email: normalizedEmail
        }).select("+password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Compare entered password with stored hash
        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive"
            });
        }

        const token = generateToken(user._id);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Login failed. Please try again."
        });
    }
};

// GET LOGGED-IN USER PROFILE
const getProfile = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            message: "User profile fetched successfully",
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role,
                isActive: req.user.isActive
            }
        });

    } catch (error) {
        console.error("Profile Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch profile"
        });
    }
};
module.exports = {
    registerUser,
    loginUser,
    getProfile
};