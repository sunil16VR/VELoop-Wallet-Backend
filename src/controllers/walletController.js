
const mongoose = require("mongoose");

const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const AuditLog = require("../models/AuditLog");

// GET USER WALLET
const getWallet = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({
            user: req.user._id
        });

        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            });
        }

        return res.status(200).json({
            success: true,
            wallet: {
                id: wallet._id,
                availableBalancePaise: wallet.availableBalancePaise,
                pendingBalancePaise: wallet.pendingBalancePaise,
                currency: wallet.currency,
                status: wallet.status
            }
        });

    } catch (error) {
        console.error("Get Wallet Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch wallet"
        });
    }
};


// GET WALLET TRANSACTION HISTORY
const getTransactions = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({
            user: req.user._id
        });

        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            });
        }

        const page = Math.max(
            1,
            parseInt(req.query.page, 10) || 1
        );

        const limit = Math.min(
            50,
            Math.max(1, parseInt(req.query.limit, 10) || 10)
        );

        const skip = (page - 1) * limit;

        const filter = {
            user: req.user._id,
            wallet: wallet._id
        };

        const transactions = await WalletTransaction.find(filter)
            .select(
                "type amountPaise balanceAfterPaise description referenceId createdAt"
            )
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await WalletTransaction.countDocuments(filter);

        return res.status(200).json({
            success: true,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            transactions
        });

    } catch (error) {
        console.error("Transaction History Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch transaction history"
        });
    }
};


// SIMULATED WALLET TRANSACTION
// Local development testing only.
const simulateTransaction = async (req, res) => {
    const {
        type,
        amountPaise,
        description,
        idempotencyKey
    } = req.body;

    if (!["CREDIT", "DEBIT"].includes(type)) {
        return res.status(400).json({
            success: false,
            message: "Type must be CREDIT or DEBIT"
        });
    }

    if (
        !Number.isSafeInteger(amountPaise) ||
        amountPaise < 1 ||
        amountPaise > 100000
    ) {
        return res.status(400).json({
            success: false,
            message: "Amount must be between 1 and 100000 paise"
        });
    }

    if (
        typeof idempotencyKey !== "string" ||
        idempotencyKey.trim().length < 8 ||
        idempotencyKey.trim().length > 100
    ) {
        return res.status(400).json({
            success: false,
            message: "A unique idempotency key is required"
        });
    }

    if (
        description !== undefined &&
        (
            typeof description !== "string" ||
            description.length > 200
        )
    ) {
        return res.status(400).json({
            success: false,
            message: "Description must be at most 200 characters"
        });
    }

    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {

            // Check for an existing transaction
            const existing = await WalletTransaction.findOne({
                idempotencyKey: idempotencyKey.trim()
            }).session(session);

            if (existing) {
                if (!existing.user.equals(req.user._id)) {
                    const error = new Error(
                        "Idempotency key already used"
                    );
                    error.statusCode = 409;
                    throw error;
                }

                result = {
                    transaction: existing,
                    duplicate: true
                };

                return;
            }

            // Find authenticated user's wallet
            const wallet = await Wallet.findOne({
                user: req.user._id
            }).session(session);

            if (!wallet) {
                const error = new Error("Wallet not found");
                error.statusCode = 404;
                throw error;
            }

            if (wallet.status !== "ACTIVE") {
                const error = new Error("Wallet is not active");
                error.statusCode = 403;
                throw error;
            }

            const conditions = {
                _id: wallet._id,
                user: req.user._id,
                status: "ACTIVE"
            };

            let update;

            if (type === "CREDIT") {
                conditions.availableBalancePaise = {
                    $lte: Number.MAX_SAFE_INTEGER - amountPaise
                };

                update = {
                    $inc: {
                        availableBalancePaise: amountPaise
                    }
                };

            } else {
                conditions.availableBalancePaise = {
                    $gte: amountPaise
                };

                update = {
                    $inc: {
                        availableBalancePaise: -amountPaise
                    }
                };
            }

            // Atomically update wallet balance
            const updatedWallet = await Wallet.findOneAndUpdate(
                conditions,
                update,
                {
                    new: true,
                    session,
                    runValidators: true
                }
            );

            if (!updatedWallet) {
                const error = new Error(
                    type === "DEBIT"
                        ? "Insufficient wallet balance"
                        : "Wallet balance could not be updated"
                );

                error.statusCode = 400;
                throw error;
            }

            // Create transaction record
            const transaction = await WalletTransaction.create(
                [{
                    wallet: wallet._id,
                    user: req.user._id,
                    type,
                    amountPaise,
                    balanceAfterPaise:
                        updatedWallet.availableBalancePaise,
                    description:
                        description || "Simulated transaction",
                    idempotencyKey: idempotencyKey.trim()
                }],
                { session }
            );

            // Create audit record
            await AuditLog.create(
                [{
                    actor: req.user._id,
                    action: `WALLET_${type}`,
                    entityType: "Wallet",
                    entityId: wallet._id,
                    details: {
                        amountPaise,
                        transactionId: transaction[0]._id
                    },
                    ipAddress: req.ip
                }],
                { session }
            );

            result = {
                transaction: transaction[0],
                duplicate: false
            };
        });

        return res.status(200).json({
            success: true,
            message: result.duplicate
                ? "Transaction was already processed"
                : "Simulated transaction successful",

            duplicate: result.duplicate,

            transaction: {
                id: result.transaction._id,
                type: result.transaction.type,
                amountPaise: result.transaction.amountPaise,
                balanceAfterPaise:
                    result.transaction.balanceAfterPaise
            }
        });

    } catch (error) {
        console.error(
            "Simulated Transaction Error:",
            error.message
        );

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode
                ? error.message
                : "Unable to process transaction"
        });

    } finally {
        await session.endSession();
    }
};


module.exports = {
    getWallet,
    getTransactions,
    simulateTransaction
};
