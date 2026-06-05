import { useContext, useState, useEffect } from "react";
import { UserContext } from "../App";
import api from "../common/api";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";

/**
 * SubscribeButton — handles subscribe/unsubscribe toggle for a publication.
 * 
 * Props:
 *   publicationId     — the _id of the publication
 *   initialSubscribed — optional boolean if already known
 *   onSubscribeChange — optional callback(isSubscribed)
 *   size              — "sm" | "md" (default "md")
 *   className         — additional CSS classes
 */
const SubscribeButton = ({ publicationId, initialSubscribed = null, onSubscribeChange, size = "md", className = "" }) => {

    const { userAuth: { access_token } } = useContext(UserContext);
    const navigate = useNavigate();

    const [isSubscribed, setIsSubscribed] = useState(initialSubscribed);
    const [loading, setLoading] = useState(false);

    // Fetch initial subscribe state if not provided
    useEffect(() => {
        if (initialSubscribed !== null || !access_token || !publicationId) return;

        api.post("/is-subscribed", { publication_id: publicationId })
            .then(({ data }) => setIsSubscribed(data.subscribed))
            .catch(() => setIsSubscribed(false));
    }, [publicationId, access_token]);

    const handleClick = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!access_token) {
            navigate("/signin");
            return;
        }

        if (loading) return;
        setLoading(true);

        const newState = !isSubscribed;
        setIsSubscribed(newState);

        try {
            const endpoint = newState ? "/subscribe" : "/unsubscribe";
            await api.post(endpoint, { publication_id: publicationId });
            onSubscribeChange?.(newState);
        } catch (err) {
            setIsSubscribed(!newState);
        } finally {
            setLoading(false);
        }
    };

    if (isSubscribed === null) return null;

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
            disabled={loading}
            aria-label={label}
        >
            <Icon name={icon} className="subscribe-btn__icon" />
            {label}
        </button>
    );
};

export default SubscribeButton;
