import { useContext, useState, useEffect } from "react";
import { UserContext } from "../App";
import api from "../common/api";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import ConfirmModal from "./confirm-modal.component";

/**
 * ConnectButton — handles the full connect lifecycle:
 *   none → Connect → pending_sent → Pending (withdraw on click)
 *   pending_received → Accept/Decline
 *   accepted → Connected (disconnect on click)
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
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);

    // Don't render if viewing own profile
    if (currentUserId === targetUserId) return null;

    // Fetch initial status if not provided
    useEffect(() => {
        if (initialStatus !== null || !access_token || !targetUserId) return;

        api.post("/connect/status", { user_id: targetUserId })
            .then(({ data }) => setStatus(data.status))
            .catch(() => setStatus('none'));
    }, [targetUserId, access_token]);

    const executeAction = async (action) => {
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

    const handleAction = (action, e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!access_token) {
            navigate("/signin");
            return;
        }

        if (loading) return;

        // Show confirmation for destructive actions
        if (action === 'withdraw') {
            setPendingAction(action);
            setShowConfirm(true);
            return;
        }

        executeAction(action);
    };

    const handleConfirm = () => {
        setShowConfirm(false);
        if (pendingAction) {
            executeAction(pendingAction);
            setPendingAction(null);
        }
    };

    const handleCancel = () => {
        setShowConfirm(false);
        setPendingAction(null);
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
            label = "Pending";
            stateClass = "connect-btn--pending";
            action = "withdraw";
            break;
        case 'accepted':
            label = "Connected";
            stateClass = "connect-btn--connected";
            action = "remove";
            break;
        default:
            label = "Connect";
            stateClass = "connect-btn--connect";
            action = "send";
    }

    return (
        <>
            <button
                className={`connect-btn ${sizeClass} ${stateClass} ${className}`}
                onClick={(e) => handleAction(action, e)}
                disabled={loading}
                aria-label={label}
            >
                {status === 'none' && <Icon name="handshake" className="connect-btn__icon" />}
                {label}
            </button>

            <ConfirmModal
                isOpen={showConfirm}
                title="Withdraw Request?"
                message="Are you sure you want to withdraw your connection request? You can always send a new one later."
                confirmLabel="Withdraw"
                cancelLabel="Keep it"
                variant="warning"
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </>
    );
};

export default ConnectButton;
