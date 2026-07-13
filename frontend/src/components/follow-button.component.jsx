import { useContext } from "react";
import { UserContext } from "../App";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { useFollowStatus, useFollowsBack } from "../hooks/queries";
import { useFollowUser } from "../hooks/mutations";

/**
 * FollowButton — handles follow/unfollow with TanStack Query.
 * Multiple instances for the same user share cached status (single API call).
 */
const FollowButton = ({ targetUserId, initiallyFollowing = undefined, initiallyFollowsYou = undefined, onFollowChange, size = "md", className = "" }) => {

    const { userAuth: { access_token, _id: currentUserId } } = useContext(UserContext);
    const navigate = useNavigate();

    // Query hooks — these deduplicate across all FollowButton instances
    const { data: isFollowing, isLoading: statusLoading } = useFollowStatus(targetUserId, initiallyFollowing);
    const { data: followsYou } = useFollowsBack(targetUserId, initiallyFollowsYou);

    // Mutation
    const followMutation = useFollowUser();

    // Don't render for own profile or if no target
    if (!targetUserId || currentUserId === targetUserId) return null;

    // Don't render until we know the state
    if (isFollowing === undefined && statusLoading) return null;

    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!access_token) {
            navigate("/signin");
            return;
        }

        if (followMutation.isPending) return;

        const action = isFollowing ? 'unfollow' : 'follow';
        followMutation.mutate(
            { userId: targetUserId, action },
            {
                onSuccess: () => {
                    onFollowChange?.(!isFollowing);
                }
            }
        );
    };

    const sizeClasses = size === "sm" ? "follow-btn--sm" : "follow-btn--md";

    const stateClass = isFollowing
        ? "follow-btn--following"
        : followsYou
        ? "follow-btn--follow-back"
        : "follow-btn--follow";

    const label = isFollowing
        ? "Following"
        : followsYou
        ? "Follow Back"
        : "Follow";

    return (
        <button
            className={`follow-btn ${sizeClasses} ${stateClass} ${className}`}
            onClick={handleClick}
            disabled={followMutation.isPending}
            aria-label={label}
        >
            {!isFollowing && <Icon name={followsYou ? "person_add" : "add"} className="follow-btn__icon" />}
            {label}
        </button>
    );
};

export default FollowButton;
