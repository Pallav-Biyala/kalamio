import User from '../Schema/User.js';

// ────────────────────────────────────────────────────────
// NOTIFICATION PREFERENCES
// ────────────────────────────────────────────────────────

const DEFAULTS = {
    like:             { in_app: true,  email: false },
    comment:          { in_app: true,  email: true },
    reply:            { in_app: true,  email: true },
    follow:           { in_app: true,  email: false },
    subscribe:        { in_app: true,  email: false },
    mention:          { in_app: true,  email: true },
    mute_all: false
};

const VALID_KEYS = new Set(Object.keys(DEFAULTS));

/**
 * POST /api/v1/settings/notification-preferences
 * Get the logged-in user's notification preferences.
 */
export const getNotificationPreferences = async (req, res) => {
    try {
        const user_id = req.user;

        const user = await User.findById(user_id).select('notification_preferences');

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({
            notification_preferences: user.notification_preferences || DEFAULTS
        });

    } catch (err) {
        console.error('[Settings] getNotificationPreferences failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/v1/settings/update-notification-preferences
 * Update the logged-in user's notification preferences.
 */
export const updateNotificationPreferences = async (req, res) => {
    try {
        const user_id = req.user;
        const { notification_preferences } = req.body;

        if (!notification_preferences || typeof notification_preferences !== 'object') {
            return res.status(400).json({ error: "notification_preferences must be an object" });
        }

        // Validate that only known keys are present
        const incomingKeys = Object.keys(notification_preferences);
        for (const key of incomingKeys) {
            if (!VALID_KEYS.has(key)) {
                return res.status(400).json({ error: `Unknown preference key: ${key}` });
            }
        }

        const updated = await User.findByIdAndUpdate(
            user_id,
            { $set: { notification_preferences } },
            { new: true }
        ).select('notification_preferences');

        if (!updated) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({
            notification_preferences: updated.notification_preferences
        });

    } catch (err) {
        console.error('[Settings] updateNotificationPreferences failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

// ────────────────────────────────────────────────────────
// PRIVACY SETTINGS
// ────────────────────────────────────────────────────────

const PRIVACY_DEFAULTS = {
    who_can_message: 'everyone',
    show_profile: 'everyone',
    show_read_count: true
};

const VALID_PRIVACY_KEYS = new Set(Object.keys(PRIVACY_DEFAULTS));
const VALID_MESSAGE_OPTIONS = ['everyone', 'nobody'];
const VALID_PROFILE_OPTIONS = ['everyone', 'logged_in'];

export const getPrivacySettings = async (req, res) => {
    try {
        const user = await User.findById(req.user).select('privacy_settings');
        if (!user) return res.status(404).json({ error: "User not found" });

        return res.status(200).json({
            privacy_settings: user.privacy_settings || PRIVACY_DEFAULTS
        });
    } catch (err) {
        console.error('[Settings] getPrivacySettings failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

export const updatePrivacySettings = async (req, res) => {
    try {
        const { privacy_settings } = req.body;

        if (!privacy_settings || typeof privacy_settings !== 'object') {
            return res.status(400).json({ error: "privacy_settings must be an object" });
        }

        for (const key of Object.keys(privacy_settings)) {
            if (!VALID_PRIVACY_KEYS.has(key)) {
                return res.status(400).json({ error: `Unknown privacy key: ${key}` });
            }
        }

        // 'connections' is a removed option, but a user's stored value may still be it (and the client
        // re-sends the full settings object on every toggle). Coerce it to a valid value before
        // validation so the whole update doesn't 400 — this also self-heals the stored value.
        if (privacy_settings.who_can_message === 'connections') privacy_settings.who_can_message = 'nobody';
        if (privacy_settings.show_profile === 'connections') privacy_settings.show_profile = 'logged_in';

        if (privacy_settings.who_can_message && !VALID_MESSAGE_OPTIONS.includes(privacy_settings.who_can_message)) {
            return res.status(400).json({ error: "Invalid value for who_can_message" });
        }
        if (privacy_settings.show_profile && !VALID_PROFILE_OPTIONS.includes(privacy_settings.show_profile)) {
            return res.status(400).json({ error: "Invalid value for show_profile" });
        }

        const updated = await User.findByIdAndUpdate(
            req.user,
            { $set: { privacy_settings } },
            { new: true }
        ).select('privacy_settings');

        if (!updated) return res.status(404).json({ error: "User not found" });

        return res.status(200).json({ privacy_settings: updated.privacy_settings });
    } catch (err) {
        console.error('[Settings] updatePrivacySettings failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

// ────────────────────────────────────────────────────────
// ACCOUNT MANAGEMENT
// ────────────────────────────────────────────────────────

export const deactivateAccount = async (req, res) => {
    try {
        const user = await User.findById(req.user);
        if (!user) return res.status(404).json({ error: "User not found" });

        if (user.account_status?.status === 'deleted') {
            return res.status(400).json({ error: "Account is already marked for deletion" });
        }

        await User.findByIdAndUpdate(req.user, {
            $set: {
                'account_status.status': 'deactivated',
                'account_status.deactivated_at': new Date()
            },
            $unset: { refreshToken: 1 }
        });

        return res.status(200).json({ deactivated: true });
    } catch (err) {
        console.error('[Settings] deactivateAccount failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

export const reactivateAccount = async (req, res) => {
    try {
        const user = await User.findById(req.user);
        if (!user) return res.status(404).json({ error: "User not found" });

        const status = user.account_status?.status;
        if (status !== 'deactivated' && status !== 'deleted') {
            return res.status(400).json({ error: "Account is already active" });
        }

        await User.findByIdAndUpdate(req.user, {
            $set: {
                'account_status.status': 'active',
                'account_status.deactivated_at': null,
                'account_status.deletion_scheduled_at': null,
                'account_status.deletion_reason': ''
            }
        });

        return res.status(200).json({ reactivated: true });
    } catch (err) {
        console.error('[Settings] reactivateAccount failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

import bcrypt from 'bcrypt';

export const deleteAccount = async (req, res) => {
    try {
        const { password, reason } = req.body;

        const user = await User.findById(req.user).select('+password');
        if (!user) return res.status(404).json({ error: "User not found" });

        // Google auth users can skip password check
        if (!user.google_auth) {
            if (!password) {
                return res.status(400).json({ error: "Password is required to delete your account" });
            }
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(403).json({ error: "Incorrect password" });
            }
        }

        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        await User.findByIdAndUpdate(req.user, {
            $set: {
                'account_status.status': 'deleted',
                'account_status.deactivated_at': new Date(),
                'account_status.deletion_scheduled_at': thirtyDaysFromNow,
                'account_status.deletion_reason': reason || ''
            },
            $unset: { refreshToken: 1 }
        });

        return res.status(200).json({
            deleted: true,
            deletion_scheduled_at: thirtyDaysFromNow,
            message: "Your account has been scheduled for deletion. You have 30 days to sign back in and cancel."
        });
    } catch (err) {
        console.error('[Settings] deleteAccount failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

export const getAccountStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user).select('account_status google_auth');
        if (!user) return res.status(404).json({ error: "User not found" });

        return res.status(200).json({
            account_status: user.account_status || { status: 'active' },
            google_auth: user.google_auth
        });
    } catch (err) {
        console.error('[Settings] getAccountStatus failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

// ────────────────────────────────────────────────────────
// DATA EXPORT
// ────────────────────────────────────────────────────────

import Post from '../Schema/Post.js';
import Comment from '../Schema/Comment.js';
import Collection from '../Schema/Collection.js';
import Follow from '../Schema/Follow.js';

export const exportData = async (req, res) => {
    try {
        const user_id = req.user;

        const [user, posts, comments, collections, followers, following] = await Promise.all([
            User.findById(user_id).select('personal_info social_links account_info notification_preferences privacy_settings joinedAt -_id'),
            Post.find({ author: user_id, draft: false }).select('blog_id title text_content type des tags content publishedAt activity -_id').lean(),
            Comment.find({ commented_by: user_id }).populate('blog_id', 'blog_id title -_id').select('comment commentedAt blog_id -_id').lean(),
            Collection.find({ owner: user_id, type: 'user' }).select('title visibility total_articles createdAt -_id').lean(),
            Follow.find({ following: user_id }).populate('follower', 'personal_info.username -_id').select('follower followedAt -_id').lean(),
            Follow.find({ follower: user_id }).populate('following', 'personal_info.username -_id').select('following followedAt -_id').lean()
        ]);

        const exportPayload = {
            exported_at: new Date().toISOString(),
            profile: user?.toObject() || {},
            posts: posts || [],
            comments: comments || [],
            collections: collections || [],
            followers: followers || [],
            following: following || []
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="kalamio-data-export.json"');
        return res.status(200).json(exportPayload);
    } catch (err) {
        console.error('[Settings] exportData failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};
