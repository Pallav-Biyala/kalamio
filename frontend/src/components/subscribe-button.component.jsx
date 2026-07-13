import { useContext } from "react";
import { UserContext } from "../App";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { useSubscribeStatus } from "../hooks/queries";
import { useSubscribeAction } from "../hooks/mutations";

/**
 * SubscribeButton — handles subscribe/unsubscribe toggle for a publication.
 * Uses TanStack Query for cached status + optimistic mutations.
 */
const SubscribeButton = ({ publicationId, initialSubscribed = undefined, onSubscribeChange, size = "md", className = "" }) => {

    const { userAuth: { access_token } } = useContext(UserContext);
    const navigate = useNavigate();

    const { data: isSubscribed, isLoading } = useSubscribeStatus(publicationId, initialSubscribed);
    const subscribeMutation = useSubscribeAction();

    if (isSubscribed === undefined && isLoading) return null;

    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!access_token) {
            navigate("/signin");
            return;
        }

        if (subscribeMutation.isPending) return;

        const action = isSubscribed ? 'unsubscribe' : 'subscribe';
        subscribeMutation.mutate(
            { publicationId, action },
            {
                onSuccess: () => {
                    onSubscribeChange?.(!isSubscribed);
                }
            }
        );
    };

    const sizeClasses = size === "sm" ? "subscribe-btn--sm" : "subscribe-btn--md";

    const stateClass = isSubscribed
        ? "subscribe-btn--subscribed"
        : "subscribe-btn--subscribe";

    const label = isSubscribed
        ? "Subscribed"
        : "Subscribe";

    const icon = isSubscribed
        ? "notifications_active"
        : "notifications";

    return (
        <button
            className={`subscribe-btn ${sizeClasses} ${stateClass} ${className}`}
            onClick={handleClick}
            disabled={subscribeMutation.isPending}
            aria-label={label}
        >
            <Icon name={icon} className="subscribe-btn__icon" />
            {label}
        </button>
    );
};

export default SubscribeButton;
