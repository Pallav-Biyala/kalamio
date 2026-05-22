import mongoose, { Schema } from "mongoose";

const messageSchema = mongoose.Schema({
    conversation: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'conversations'
    },
    sender: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'users'
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: [5000, 'Message cannot exceed 5000 characters']
    },
    read: {
        type: Boolean,
        default: false
    }
},
{
    timestamps: {
        createdAt: 'sentAt',
        updatedAt: false
    }
});

// Fast message history: load messages for a conversation, newest first
messageSchema.index({ conversation: 1, sentAt: -1 });

// Fast unread count queries
messageSchema.index({ conversation: 1, sender: 1, read: 1 });

export default mongoose.model("messages", messageSchema);
