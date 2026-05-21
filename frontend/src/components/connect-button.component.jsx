import { useContext, useState, useEffect } from "react";
import { UserContext } from "../App";
import api from "../common/api";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";

/**
 * ConnectButton — handles the full connect lifecycle:
 *   none → Connect → pending_sent → Pending (withdraw on click)
 *   pending_received → Accept/Decline
 *   accepted → Connected (disconnect on hover)
 * 
 * Props:
 *   targetUserId      — the _id of the user to connect with
 *   initialStatus     — optional: 'none' | 'pending_sent' | 'pending_received' | 'accepted'
 *   onStatusChange    — optional callback(newStatus)
 *   size              — "sm" | "md" (default "md")
 *   className         — additional CSS classes
 */
const ConnectButton = ({ targetUserId, initialStatus = null, onStatusChange, size = "md", className = "" }) => {

    const { userAuth: { access_token, _id: currentUserId } } = useContext(UserContext);
    const navigate = useNavigate();

    const [status, setStatus] = useState(initialStatus);
    const [loading, setLoading] = useState(false);
    const [hovered, setHovered] = useState(false);

    // Don't render if viewing own profile
    if (currentUserId === targetUserId) return null;

    // Fetch initial status if not provided
    useEffect(() => {
        if (initialStatus !== null || !access_token || !targetUserId) return;

        api.post("/connect/status", { user_id: targetUserId })
            .then(({ data }) => setStatus(data.status))
            .catch(() => setStatus('none'));
    }, [targetUserId, access_token]);

    const handleAction = async (action, e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!access_token) {
            navigate("/signin");
            return;
        }

        if (loading) return;
        setLoading(true);

        try {
            let endpoint, newStatus;

            switch (action) {
                case 'send':
                    endpoint = "/connect/send";
                    newStatus = 'pending_sent';
                    break;
                case 'withdraw':
                    endpoint = "/connect/withdraw";
                    newStatus = 'none';
                    break;
                case 'accept':
                    endpoint = "/connect/accept";
                    newStatus = 'accepted';
                    break;
                case 'decline':
                    endpoint = "/connect/decline";
                    newStatus = 'none';
                    break;
                case 'remove':
                    endpoint = "/connect/remove";
                    newStatus = 'none';
                    break;
                default:
                    return;
            }

            // Optimistic update
            setStatus(newStatus);

            const { data } = await api.post(endpoint, { user_id: targetUserId });

            // Server may auto-accept mutual requests
            if (data.status === 'accepted' && newStatus !== 'accepted') {
                setStatus('accepted');
            }

            onStatusChange?.(data.status || newStatus);

        } catch (err) {
            // Revert on failure — refetch actual status
            api.post("/connect/status", { user_id: targetUserId })
                .then(({ data }) => setStatus(data.status))
                .catch(() => {});
        } finally {
            setLoading(false);
        }
    };

    // Don't render until we know the state
    if (status === null) return null;

    const sizeClass = size === "sm" ? "connect-btn--sm" : "connect-btn--md";

    // Pending received — show Accept/Decline inline
    if (status === 'pending_received') {
        return (
            <div className={`connect-btn-group ${className}`}>
                <button
                    className={`connect-btn ${sizeClass} connect-btn--accept`}
                    onClick={(e) => handleAction('accept', e)}
                    disabled={loading}
                >
                    <Icon name="check" className="connect-btn__icon" />
                    Accept
                </button>
                <button
                    className={`connect-btn ${sizeClass} connect-btn--decline`}
                    onClick={(e) => handleAction('decline', e)}
                    disabled={loading}
                >
                    <Icon name="close" className="connect-btn__icon" />
                    Decline
                </button>
            </div>
        );
    }

    // Determine button appearance and action
    let label, stateClass, action;

    switch (status) {
        case 'none':
            label = "Connect";
            stateClass = "connect-btn--connect";
            action = "send";
            break;
        case 'pending_sent':
            label = hovered ? "Withdraw" : "Pending";
            stateClass = hovered ? "connect-btn--withdraw" : "connect-btn--pending";
            action = "withdraw";
            break;
        case 'accepted':
            label = hovered ? "Disconnect" : "Connected";
            stateClass = hovered ? "connect-btn--disconnect" : "connect-btn--connected";
            action = "remove";
            break;
        default:
            label = "Connect";
            stateClass = "connect-btn--connect";
            action = "send";
    }

    return (
        <button
            className={`connect-btn ${sizeClass} ${stateClass} ${className}`}
            onClick={(e) => handleAction(action, e)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            disabled={loading}
            aria-label={label}
        >
            {status === 'none' && <Icon name="handshake" className="connect-btn__icon" />}
            {label}
        </button>
    );
};

export default ConnectButton;
