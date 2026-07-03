import mongoose, { Schema } from "mongoose";

const conversationSchema = mongoose.Schema({
    participants: [{
        type: Schema.Types.ObjectId,
        ref: 'users',
        required: true
    }],
    // 'dm' = between connected users, 'request' = from non-connected user
    type: {
        type: String,
        enum: ['dm', 'request'],
        default: 'request'
    },
    // For requests: 'pending' → needs acceptance, 'accepted' → promoted to dm, 'declined' → rejected
    request_status: {
        type: String,
        enum: [null, 'pending', 'accepted', 'declined'],
        default: null
    },
    // Who initiated the request (the sender of the first message)
    request_initiator: {
        type: Schema.Types.ObjectId,
        ref: 'users',
        default: null
    },
    last_message: {
        content: { type: String, default: "" },
        sender: { type: Schema.Types.ObjectId, ref: 'users' },
        timestamp: { type: Date, default: Date.now }
    },
    // Per-user unread counts: { "userId1": 3, "userId2": 0 }
    unread_counts: {
        type: Map,
        of: Number,
        default: {}
    }
},
{
    timestamps: true
});

// List conversations for a user, sorted by most recent message
conversationSchema.index({ participants: 1, "last_message.timestamp": -1 });

// Unique conversation between two users (sorted pair)
conversationSchema.index({ participants: 1, type: 1 });

export default mongoose.model("conversations", conversationSchema);
