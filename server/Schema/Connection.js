import mongoose, { Schema } from "mongoose";

const connectionSchema = mongoose.Schema({
    requester: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'users'
    },
    recipient: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'users'
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined'],
        default: 'pending'
    },
    acceptedAt: {
        type: Date,
        default: null
    }
},
{
    timestamps: {
        createdAt: 'requestedAt',
        updatedAt: false
    }
});

// Unique — only one connection between any two users (direction-specific)
connectionSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Quickly find all pending requests for a user
connectionSchema.index({ recipient: 1, status: 1, requestedAt: -1 });

// Quickly find all accepted connections for a user (either direction)
connectionSchema.index({ requester: 1, status: 1 });
connectionSchema.index({ recipient: 1, status: 1 });

export default mongoose.model("connections", connectionSchema);
