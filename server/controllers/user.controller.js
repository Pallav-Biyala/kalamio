import User, { generateAvatar } from '../Schema/User.js';
import Follow from '../Schema/Follow.js';
import Connection from '../Schema/Connection.js';
import { escapeRegex } from '../utils/helpers.js';

// Search Users
export const searchUsers = (req, res) => {

    let { query } = req.body;

    User.find({
        "personal_info.username": new RegExp(escapeRegex(query), 'i'),
        $or: [
            { 'account_status.status': { $exists: false } },
            { 'account_status.status': 'active' }
        ]
    })
    .limit(50)
    .select("personal_info.fullname personal_info.username personal_info.profile_img")
    .then(users => {
        return res.status(200).json({ users })
    })
    .catch(err => {
        return res.status(500).json({ error: err.message })
    })

};

// Get profile
export const getProfile = (req, res) => {
    let { username } = req.body;

    User.findOne({ "personal_info.username": username })
    .select("-personal_info.password -google_auth -updatedAt -blogs -refreshToken")
    .then(user => {
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Hide deactivated/deleted profiles
        const status = user.account_status?.status;
        if (status === 'deactivated' || status === 'deleted') {
            return res.status(404).json({ error: "User not found" });
        }

        // Respect privacy: hide read count and connections if user opted out
        const userObj = user.toObject();
        if (userObj.privacy_settings?.show_read_count === false) {
            userObj.account_info.total_reads = undefined;
        }
        if (userObj.privacy_settings?.show_connections === false) {
            userObj.account_info.total_connections = undefined;
        }

        return res.status(200).json(userObj)
    })
    .catch(err => {
        console.error('[User] getProfile failed:', err.message);
        return res.status(500).json({ error: err.message })
    })
};

// Update profile image
export const updateProfileImg = async (req, res) => {
    try {
        let { url } = req.body;

        if (!url) {
            const user = await User.findById(req.user);
            url = generateAvatar(user.personal_info.fullname || user.personal_info.username);
        }

        await User.findOneAndUpdate({ _id: req.user }, { "personal_info.profile_img": url });
        return res.status(200).json({ profile_img: url });
    } catch(err) {
        return res.status(500).json({ error: err.message });
    }
};

// Update profile
export const updateProfile = (req, res) => {

    let { username, bio, social_links } = req.body;
    let bioLimit = 150;

    if(username.length < 3){
        return res.status(403).json({ error: "Username should be at least 3 letters long" })
    }
    if(bio.length > bioLimit){
        return res.status(403).json({ error: `Bio should not be more than ${bioLimit} characters` })
    }

    let socialLinksArr = Object.keys(social_links);

    try {

        for(let i=0; i < socialLinksArr.length; i++){
            if(social_links[socialLinksArr[i]].length){
                let hostname = new URL(social_links[socialLinksArr[i]]).hostname;

                if(!hostname.includes(`${socialLinksArr[i]}.com`) && socialLinksArr[i] != 'website'){
                    return res.status(403).json({ error: `${socialLinksArr[i]} link is invalid. You must enter a full link` })
                }
            }
        }

    } catch (err) {
        return res.status(500).json({ error: "You must provide full social links with http(s) included" })
    }

    let updateObj = {
        "personal_info.username": username,
        "personal_info.bio": bio,
        social_links
    }

    User.findOneAndUpdate({ _id: req.user }, updateObj, {
        runValidators: true
    })
    .then(() => {
        return res.status(200).json({ username })
    })
    .catch(err => {
        if(err.code == 11000){
            return res.status(409).json({ error: "username is already taken" })
        }
        return res.status(500).json({ error: err.message })
    })

};

// Search users that the current user follows or is connected to
export const searchConnectionsFollows = async (req, res) => {
    let { query } = req.body;
    let userId = req.user;

    try {
        const follows = await Follow.find({ follower: userId }).select('following');
        const followedIds = follows.map(f => f.following);

        const connections = await Connection.find({
            $or: [{ requester: userId }, { recipient: userId }],
            status: 'accepted'
        }).select('requester recipient');
        
        const connectedIds = connections.map(c => 
            c.requester.toString() === userId.toString() ? c.recipient : c.requester
        );

        const uniqueIds = [...new Set([...followedIds.map(String), ...connectedIds.map(String)])].filter(id => id !== 'undefined' && id);

        let users = await User.find({
            _id: { $in: uniqueIds },
            $or: [
                { "personal_info.username": new RegExp(escapeRegex(query), 'i') },
                { "personal_info.fullname": new RegExp(escapeRegex(query), 'i') }
            ]
        })
        .limit(10)
        .select("personal_info.fullname personal_info.username personal_info.profile_img");

        if (users.length < 10 && query && query.trim() !== '') {
            const extraUsers = await User.find({
                _id: { $nin: [...uniqueIds, userId] },
                $or: [
                    { "personal_info.username": new RegExp(escapeRegex(query), 'i') },
                    { "personal_info.fullname": new RegExp(escapeRegex(query), 'i') }
                ]
            })
            .limit(10 - users.length)
            .select("personal_info.fullname personal_info.username personal_info.profile_img");

            users = [...users, ...extraUsers];
        }

        return res.status(200).json({ users });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
