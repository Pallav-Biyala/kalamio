import User from '../Schema/User.js';

// ────────────────────────────────────────────────────────
// NOTIFICATION PREFERENCES
// ────────────────────────────────────────────────────────

const DEFAULTS = {
    like:             { in_app: true,  email: false },
    comment:          { in_app: true,  email: true },
    reply:            { in_app: true,  email: true },
    follow:           { in_app: true,  email: false },
    connect_request:  { in_app: true,  email: true },
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
