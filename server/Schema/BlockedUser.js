import mongoose, { Schema } from 'mongoose';

const blockedUserSchema = mongoose.Schema({
    blocker: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'users'
    },
    blocked: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'users'
    }
},
{
    timestamps: {
        createdAt: 'blockedAt',
        updatedAt: false
    }
});

// Unique — a user can only block another user once
blockedUserSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

// List a user's blocked users efficiently (sorted by newest first)
blockedUserSchema.index({ blocker: 1, blockedAt: -1 });

export default mongoose.model('blocked_users', blockedUserSchema);
