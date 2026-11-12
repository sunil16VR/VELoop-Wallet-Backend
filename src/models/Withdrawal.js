
const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Wallet",
            required: true
        },

        amountPaise: {
            type: Number,
            required: true,
            min: 1
        },

        payoutMethod: {
            type: String,
            enum: ["UPI", "BANK_TRANSFER"],
            required: true
        },

        payoutDetails: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
            select: false
        },

        status: {
            type: String,
            enum: [
                "PENDING",
                "PROCESSING",
                "APPROVED",
                "REJECTED",
                "CANCELLED"
            ],
            default: "PENDING"
        },

        idempotencyKey: {
            type: String,
            required: true
        },

        rejectionReason: {
            type: String,
            default: ""
        },

        processedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

withdrawalSchema.index({ user: 1, createdAt: -1 });
withdrawalSchema.index(
    { user: 1, idempotencyKey: 1 },
    { unique: true }
);

const Withdrawal = mongoose.model("Withdrawal", withdrawalSchema);

module.exports = Withdrawal;
