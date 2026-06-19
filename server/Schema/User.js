import mongoose, { Schema } from "mongoose";

const AVATAR_COLORS = [
    "#6D5D4B", // warm taupe
    "#7A6A58", // muted brown
    "#6B7A6A", // sage green
    "#60727A", // dusty blue
    "#7A6672", // muted plum
    "#8A7458", // soft amber
    "#6F6A84", // muted indigo
    "#7C7C68", // olive grey
];

/**
 * Generate an avatar string from a full name.
 * Format: "avatar:#HEX:INITIALS"
 * e.g. "avatar:#6D5D4B:HS" for "Harish Sehlangia"
 */
export function generateAvatar(fullname) {
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const parts = fullname.trim().split(/\s+/);
    let initials;
    if (parts.length >= 2) {
        initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else {
        initials = parts[0][0].toUpperCase();
    }
    return `avatar:${color}:${initials}`;
}

const userSchema = mongoose.Schema({

    personal_info: {
        fullname: {
            type: String,
            lowercase: true,
            required: true,
            minlength: [3, 'fullname must be 3 letters long'],
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            unique: true
        },
        password: {
            type: String,
            select: false,
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        username: {
            type: String,
            minlength: [3, 'Username must be 3 letters long'],
            unique: true,
        },
        bio: {
            type: String,
            maxlength: [200, 'Bio should not be more than 200'],
            default: "",
        },
        profile_img: {
            type: String,
            default: ""
        },
    },
    social_links: {
        youtube: {
            type: String,
            default: "",
        },
        instagram: {
            type: String,
            default: "",
        },
        facebook: {
            type: String,
            default: "",
        },
        twitter: {
            type: String,
            default: "",
        },
        github: {
            type: String,
            default: "",
        },
        website: {
            type: String,
            default: "",
        }
    },
    account_info:{
        total_posts: {
            type: Number,
            default: 0
        },
        total_reads: {
            type: Number,
            default: 0
        },
        total_followers: {
            type: Number,
            default: 0
        },
        total_following: {
            type: Number,
            default: 0
        },
        total_connections: {
            type: Number,
            default: 0
        },
    },
    google_auth: {
        type: Boolean,
        default: false
    },
    provider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local',
    },
    refreshToken: {
        type: String,
        select: false, // never exposed in normal queries
    },
    blogs: {
        type: [ Schema.Types.ObjectId ],
        ref: 'blogs',
        default: [],
    },
    notification_preferences: {
        like:             { in_app: { type: Boolean, default: true },  email: { type: Boolean, default: false } },
        comment:          { in_app: { type: Boolean, default: true },  email: { type: Boolean, default: true } },
        reply:            { in_app: { type: Boolean, default: true },  email: { type: Boolean, default: true } },
        follow:           { in_app: { type: Boolean, default: true },  email: { type: Boolean, default: false } },
        connect_request:  { in_app: { type: Boolean, default: true },  email: { type: Boolean, default: true } },
        subscribe:        { in_app: { type: Boolean, default: true },  email: { type: Boolean, default: false } },
        mention:          { in_app: { type: Boolean, default: true },  email: { type: Boolean, default: true } },
        mute_all:         { type: Boolean, default: false }
    },
    account_status: {
        status:                { type: String, enum: ['active', 'deactivated', 'deleted'], default: 'active' },
        deactivated_at:        { type: Date, default: null },
        deletion_scheduled_at: { type: Date, default: null },
        deletion_reason:       { type: String, default: '' }
    },
    privacy_settings: {
        who_can_message:  { type: String, enum: ['everyone', 'connections', 'nobody'], default: 'everyone' },
        show_profile:     { type: String, enum: ['everyone', 'logged_in', 'connections'], default: 'everyone' },
        show_read_count:  { type: Boolean, default: true },
        show_connections: { type: Boolean, default: true }
    }
}, 
{ 
    timestamps: {
        createdAt: 'joinedAt'
    } 

})

// ── Indexes for query performance ──────────────────────────────────
// unique: true in schema creates indexes, but explicit indexes ensure clarity
userSchema.index({ 'personal_info.email': 1 });      // login lookups
userSchema.index({ 'personal_info.username': 1 });    // profile lookups, search

export default mongoose.model("users", userSchema);