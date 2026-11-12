
const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        availableBalancePaise: {
            type: Number,
            default: 0,
            min: 0
        },

        pendingBalancePaise: {
            type: Number,
            default: 0,
            min: 0
        },

        currency: {
            type: String,
            default: "INR"
        },

        status: {
            type: String,
            enum: ["ACTIVE", "FROZEN", "CLOSED"],
            default: "ACTIVE"
        }
    },
    {
        timestamps: true
    }
);

const Wallet = mongoose.model("Wallet", walletSchema);

module.exports = Wallet;
