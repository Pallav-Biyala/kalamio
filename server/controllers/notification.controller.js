import Notification from '../Schema/Notification.js';

// Check for new notifications (red dot)
export const newNotification = (req, res) => {

    let user_id = req.user;

    Notification.exists({ notification_for: user_id, seen: false, user: { $ne: user_id } })
    .then(result => {
        if(result){
            return res.status(200).json({ new_notification_available: true })
        } else{
            return res.status(200).json({ new_notification_available: false })
        }
    })
    .catch(err => {
        console.error('[Notification] newNotification failed:', err.message);
        return res.status(500).json({ error: err.message })
    })

};

// Get notifications
export const getNotifications = (req, res) => {

    let user_id = req.user;

    let { page, filter, deletedDocCount } = req.body;

    let maxLimit = 10;

    let findQuery = { notification_for: user_id, user: { $ne: user_id } }

    let skipDocs = (page - 1) * maxLimit;

    if(filter != 'all'){
        findQuery.type = filter;
    }

    if(deletedDocCount){
        skipDocs -= deletedDocCount;
    }

    Notification.find(findQuery)
    .skip(skipDocs)
    .limit(maxLimit)
    .populate("blog", "title blog_id text_content type poll")
    .populate("user", "personal_info.fullname personal_info.username personal_info.profile_img")
    .populate("comment", "comment")
    .populate("replied_on_comment", "comment")
    .populate("reply", "comment")
    .sort({ createdAt: -1 })
    .select("createdAt type seen reply option_index")
    .then(notifications => {

        // Mark fetched notifications as seen using their actual _ids
        // (updateMany doesn't support .skip()/.limit())
        let notificationIds = notifications.map(n => n._id);
        if (notificationIds.length) {
            Notification.updateMany({ _id: { $in: notificationIds } }, { seen: true })
            .catch(err => console.error('[Notification] Failed to mark as seen:', err.message));
        }

        return res.status(200).json({ notifications })
    })
    .catch(err => {
        console.error('[Notification] getNotifications failed:', err.message);
        return res.status(500).json({ error: err.message });
    })

};

// All notifications count
export const allNotificationsCount = (req, res) => {

    let user_id = req.user;

    let { filter } = req.body;

    let findQuery = { notification_for: user_id, user: { $ne: user_id } }

    if(filter != 'all'){
        findQuery.type = filter;
    }

    Notification.countDocuments(findQuery)
    .then(count => {
        return res.status(200).json({ totalDocs: count });
    })
    .catch(err => {
        return res.status(500).json({error: err.message})
    })

};

// Mark all notifications as read
export const markAllNotificationsRead = (req, res) => {

    let user_id = req.user;

    Notification.updateMany({ notification_for: user_id, seen: false }, { seen: true })
    .then(result => {
        return res.status(200).json({ success: true, modified_count: result.modifiedCount });
    })
    .catch(err => {
        console.error('[Notification] markAllNotificationsRead failed:', err.message);
        return res.status(500).json({ error: err.message });
    })

};

// Delete a single notification (with ownership check)
export const deleteNotification = (req, res) => {

    let user_id = req.user;
    let { _id } = req.body;

    if (!_id) {
        return res.status(400).json({ error: "Notification ID is required" });
    }

    Notification.findById(_id)
    .then(notification => {
        if (!notification || notification.notification_for.toString() !== user_id) {
            return res.status(404).json({ error: "Notification not found" });
        }

        Notification.findByIdAndDelete(_id)
        .then(() => {
            return res.status(200).json({ deleted: true });
        })
        .catch(err => {
            return res.status(500).json({ error: err.message });
        })
    })
    .catch(err => {
        console.error('[Notification] deleteNotification failed:', err.message);
        return res.status(500).json({ error: err.message });
    })

};
