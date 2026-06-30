import { useContext, useState, useEffect } from "react";
import { UserContext } from "../App";
import api from "../common/api";
import { useNavigate } from "react-router-dom";

/**
 * FollowButton — handles follow/unfollow toggle with optimistic UI.
 * 
 * Props:
 *   targetUserId  — the _id of the user to follow/unfollow
 *   initiallyFollowing — optional boolean if already known
 *   onFollowChange — optional callback(isFollowing) after state changes
 *   size — "sm" | "md" (default "md")
 *   className — additional CSS classes
 */
const FollowButton = ({ targetUserId, initiallyFollowing = null, initialFollowsYou = null, onFollowChange, size = "md", className = "" }) => {

    const { userAuth: { access_token, _id: currentUserId } } = useContext(UserContext);
    const navigate = useNavigate();

    const [isFollowing, setIsFollowing] = useState(initiallyFollowing);
    const [loading, setLoading] = useState(false);
    const [followsYou, setFollowsYou] = useState(initialFollowsYou ?? false);

    // Don't render if viewing own profile
    if (currentUserId === targetUserId) return null;

    // Sync state when parent provides batch data after initial render
    useEffect(() => {
        if (initiallyFollowing !== null) setIsFollowing(initiallyFollowing);
    }, [initiallyFollowing]);

    useEffect(() => {
        if (initialFollowsYou !== null) setFollowsYou(initialFollowsYou);
    }, [initialFollowsYou]);

    // Fetch initial follow state only if parent didn't provide it
    useEffect(() => {
        if (!access_token || !targetUserId) return;

        // Check if current user follows the target
        if (initiallyFollowing === null) {
            api.post("/is-following", { user_id: targetUserId })
                .then(({ data }) => setIsFollowing(data.following))
                .catch(() => setIsFollowing(false));
        }

        // Check if target user follows the current user (skip if parent provided the data)
        if (initialFollowsYou === null) {
            api.post("/is-following-back", { user_id: targetUserId })
                .then(({ data }) => setFollowsYou(data.follows_you))
                .catch(() => setFollowsYou(false));
        }
    }, [targetUserId, access_token]);

    const handleClick = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!access_token) {
            navigate("/signin");
            return;
        }

        if (loading) return;

        setLoading(true);

        // Optimistic update
        const newState = !isFollowing;
        setIsFollowing(newState);

        try {
            const endpoint = newState ? "/follow" : "/unfollow";
            await api.post(endpoint, { user_id: targetUserId });
            onFollowChange?.(newState);
        } catch (err) {
            // Revert on failure
            setIsFollowing(!newState);
        } finally {
            setLoading(false);
        }
    };

    // Don't render until we know the state
    if (isFollowing === null) return null;

    const sizeClasses = size === "sm" 
        ? "follow-btn--sm" 
        : "follow-btn--md";

    const stateClass = isFollowing 
        ? "follow-btn--following"
        : "follow-btn--follow";

    const label = isFollowing 
        ? "Following" 
        : (followsYou ? "Follow Back" : "Follow");

    return (
        <button
            className={`follow-btn ${sizeClasses} ${stateClass} ${className}`}
            onClick={handleClick}
            disabled={loading}
            aria-label={label}
        >
            {label}
        </button>
    );
};

export default FollowButton;
