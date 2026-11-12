
const mongoose = require("mongoose");

const payoutOptionSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        code: {
            type: String,
            enum: ["UPI", "BANK_TRANSFER"],
            required: true,
            unique: true
        },

        minimumAmountPaise: {
            type: Number,
            required: true,
            min: 1
        },

        maximumAmountPaise: {
            type: Number,
            required: true,
            min: 1
        },

        processingTime: {
            type: String,
            required: true
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

const PayoutOption = mongoose.model(
    "PayoutOption",
    payoutOptionSchema
);

module.exports = PayoutOption;
