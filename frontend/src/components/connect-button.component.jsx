import { useContext } from "react";
import { UserContext } from "../App";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import ConfirmModal from "./confirm-modal.component";
import { useState } from "react";
import { useConnectStatus } from "../hooks/queries";
import { useConnectAction } from "../hooks/mutations";

/**
 * ConnectButton — handles the full connect lifecycle with TanStack Query.
 */
const ConnectButton = ({ targetUserId, initialStatus = undefined, onStatusChange, size = "md", className = "" }) => {

    const { userAuth: { access_token, _id: currentUserId } } = useContext(UserContext);
    const navigate = useNavigate();

    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);

    // Don't render if viewing own profile
    if (currentUserId === targetUserId) return null;

    const { data: status, isLoading } = useConnectStatus(targetUserId, initialStatus);
    const connectMutation = useConnectAction();

    // Don't render until we know the state
    if (status === undefined && isLoading) return null;

    const handleAction = (action, e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!access_token) {
            navigate("/signin");
            return;
        }

        if (connectMutation.isPending) return;

        // Show confirmation for destructive actions
        if (action === 'withdraw') {
            setPendingAction(action);
            setShowConfirm(true);
            return;
        }

        connectMutation.mutate(
            { userId: targetUserId, action },
            { onSuccess: (data) => onStatusChange?.(data?.data?.status || action) }
        );
    };

    const handleConfirm = () => {
        setShowConfirm(false);
        if (pendingAction) {
            connectMutation.mutate(
                { userId: targetUserId, action: pendingAction },
                { onSuccess: (data) => onStatusChange?.(data?.data?.status || pendingAction) }
            );
            setPendingAction(null);
        }
    };

    const handleCancel = () => {
        setShowConfirm(false);
        setPendingAction(null);
    };

    const sizeClass = size === "sm" ? "connect-btn--sm" : "connect-btn--md";

    // Pending received — show Accept/Decline inline
    if (status === 'pending_received') {
        return (
            <div className={`connect-btn-group ${className}`}>
                <button
                    className={`connect-btn ${sizeClass} connect-btn--accept`}
                    onClick={(e) => handleAction('accept', e)}
                    disabled={connectMutation.isPending}
                >
                    <Icon name="check" className="connect-btn__icon" />
                    Accept
                </button>
                <button
                    className={`connect-btn ${sizeClass} connect-btn--decline`}
                    onClick={(e) => handleAction('decline', e)}
                    disabled={connectMutation.isPending}
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
                disabled={connectMutation.isPending}
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
