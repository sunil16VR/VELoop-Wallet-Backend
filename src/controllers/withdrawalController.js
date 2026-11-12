
const mongoose = require("mongoose");

const Wallet = require("../models/Wallet");
const Withdrawal = require("../models/Withdrawal");
const WalletTransaction = require("../models/WalletTransaction");
const AuditLog = require("../models/AuditLog");
const { runTransaction } = require("../utils/transaction");

// Create a withdrawal request
const createWithdrawal = async (req, res) => {
    const {
        amountPaise,
        payoutMethod,
        payoutDetails,
        idempotencyKey
    } = req.body;

    if (
        !Number.isSafeInteger(amountPaise) ||
        amountPaise <= 0 ||
        amountPaise > 100000
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid withdrawal amount"
        });
    }

    if (!["UPI", "BANK_TRANSFER"].includes(payoutMethod)) {
        return res.status(400).json({
            success: false,
            message: "Invalid payout method"
        });
    }

    if (
        !payoutDetails ||
        typeof payoutDetails !== "object" ||
        Array.isArray(payoutDetails)
    ) {
        return res.status(400).json({
            success: false,
            message: "Valid payout details are required"
        });
    }

    if (
        typeof idempotencyKey !== "string" ||
        idempotencyKey.trim().length < 8 ||
        idempotencyKey.trim().length > 100
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid idempotency key"
        });
    }

    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            const existing = await Withdrawal.findOne({
                user: req.user._id,
                idempotencyKey: idempotencyKey.trim()
            }).session(session);

            if (existing) {
                result = {
                    duplicate: true,
                    withdrawal: existing
                };
                return;
            }

            const wallet = await Wallet.findOne({
                user: req.user._id
            }).session(session);

            if (!wallet) {
                throw new Error("Wallet not found");
            }

            if (wallet.status !== "ACTIVE") {
                throw new Error("Wallet is not active");
            }

            const updatedWallet = await Wallet.findOneAndUpdate(
                {
                    _id: wallet._id,
                    user: req.user._id,
                    status: "ACTIVE",
                    availableBalancePaise: { $gte: amountPaise }
                },
                {
                    $inc: {
                        availableBalancePaise: -amountPaise,
                        pendingBalancePaise: amountPaise
                    }
                },
                {
                    new: true,
                    session
                }
            );

            if (!updatedWallet) {
                throw new Error("Insufficient wallet balance");
            }

            const [withdrawal] = await Withdrawal.create(
                [{
                    user: req.user._id,
                    wallet: wallet._id,
                    amountPaise,
                    payoutMethod,
                    payoutDetails,
                    status: "PENDING",
                    idempotencyKey: idempotencyKey.trim()
                }],
                { session }
            );

            await WalletTransaction.create(
                [{
                    wallet: wallet._id,
                    user: req.user._id,
                    type: "WITHDRAWAL_HOLD",
                    amountPaise,
                    balanceAfterPaise:
                        updatedWallet.availableBalancePaise,
                    description: "Withdrawal request created",
                    referenceId: withdrawal._id
                }],
                { session }
            );

            await AuditLog.create(
                [{
                    actor: req.user._id,
                    action: "WITHDRAWAL_CREATED",
                    entityType: "Withdrawal",
                    entityId: withdrawal._id,
                    details: {
                        amountPaise,
                        payoutMethod
                    },
                    ipAddress: req.ip
                }],
                { session }
            );

            result = {
                duplicate: false,
                withdrawal
            };
        });

        return res.status(result.duplicate ? 200 : 201).json({
            success: true,
            message: result.duplicate
                ? "Withdrawal request already exists"
                : "Withdrawal request created successfully",
            duplicate: result.duplicate,
            withdrawal: {
                id: result.withdrawal._id,
                amountPaise: result.withdrawal.amountPaise,
                payoutMethod: result.withdrawal.payoutMethod,
                status: result.withdrawal.status,
                createdAt: result.withdrawal.createdAt
            }
        });

    } catch (error) {
        console.error("Create withdrawal error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Duplicate withdrawal request"
            });
        }

        const statusCode =
            error.message === "Insufficient wallet balance" ? 400 :
            error.message === "Wallet not found" ? 404 :
            error.message === "Wallet is not active" ? 403 : 500;

        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500
                ? "Unable to create withdrawal request"
                : error.message
        });

    } finally {
        await session.endSession();
    }
};

// Get withdrawal history
const getWithdrawals = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(
            50,
            Math.max(1, parseInt(req.query.limit, 10) || 10)
        );

        const filter = { user: req.user._id };

        const [withdrawals, total] = await Promise.all([
            Withdrawal.find(filter)
                .select("-payoutDetails")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),

            Withdrawal.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            withdrawals
        });

    } catch (error) {
        console.error("Get withdrawals error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch withdrawals"
        });
    }
};

module.exports = {
    createWithdrawal,
    getWithdrawals
};
