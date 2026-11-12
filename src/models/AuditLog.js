
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
    {
        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        action: {
            type: String,
            required: true
        },

        entityType: {
            type: String,
            required: true
        },

        entityId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },

        details: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },

        ipAddress: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

auditLogSchema.index({ actor: 1, createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

module.exports = AuditLog;
