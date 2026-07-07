import mongoose, { Schema } from "mongoose";

const readEventSchema = new mongoose.Schema({
    blog: {
        type: Schema.Types.ObjectId,
        ref: 'blogs',
        required: true,
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'users',
        default: null,
    },
    fingerprint: {
        type: String,
        required: true,
    },
    ip_hash: {
        type: String,
        required: true,
    },
    user_agent: {
        type: String,
        default: '',
    },
    scroll_depth: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
    },
    read_duration: {
        type: Number,
        min: 0,
        default: 0,
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
});

// Dedup index for logged-in users: (blog + user) within time window
readEventSchema.index({ blog: 1, user: 1, created_at: -1 });

// Dedup index for anonymous users: (blog + fingerprint) within time window
readEventSchema.index({ blog: 1, fingerprint: 1, created_at: -1 });

// TTL index: auto-delete read events older than 90 days
readEventSchema.index({ created_at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const ReadEvent = mongoose.model("read_events", readEventSchema);

export default ReadEvent;
