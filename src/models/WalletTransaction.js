
const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema(
    {
        wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Wallet",
            required: true
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        type: {
            type: String,
            enum: [
                "CREDIT",
                "DEBIT",
                "WITHDRAWAL_HOLD",
                "WITHDRAWAL_RELEASE",
                "REFUND"
            ],
            required: true
        },

        amountPaise: {
            type: Number,
            required: true,
            min: 1
        },

        balanceAfterPaise: {
            type: Number,
            required: true,
            min: 0
        },

        description: {
            type: String,
            trim: true,
            default: ""
        },

        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },

        idempotencyKey: {
            type: String,
            trim: true,
            default: undefined
        }
    },
    {
        timestamps: true
    }
);

// Index for transaction history
walletTransactionSchema.index({
    user: 1,
    createdAt: -1
});

// Prevent duplicate transaction keys
walletTransactionSchema.index(
    { idempotencyKey: 1 },
    {
        unique: true,
        partialFilterExpression: {
            idempotencyKey: { $type: "string" }
        }
    }
);

const WalletTransaction = mongoose.model(
    "WalletTransaction",
    walletTransactionSchema
);

module.exports = WalletTransaction;
