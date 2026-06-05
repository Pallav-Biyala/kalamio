import { useEffect, useRef } from "react";
import Icon from "./Icon";

/**
 * ConfirmModal — a custom confirmation dialog.
 *
 * Props:
 *   isOpen    — boolean to show/hide
 *   title     — heading text
 *   message   — body text
 *   confirmLabel — text for the confirm button (default "Confirm")
 *   cancelLabel  — text for the cancel button (default "Cancel")
 *   variant   — "danger" | "warning" | "default" (default "warning")
 *   onConfirm — callback when confirmed
 *   onCancel  — callback when cancelled
 */
const ConfirmModal = ({
    isOpen,
    title = "Are you sure?",
    message = "",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "warning",
    onConfirm,
    onCancel
}) => {
    const overlayRef = useRef(null);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === "Escape") onCancel?.();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [isOpen, onCancel]);

    // Close on overlay click
    const handleOverlayClick = (e) => {
        if (e.target === overlayRef.current) onCancel?.();
    };

    if (!isOpen) return null;

    const iconMap = {
        danger: "error",
        warning: "warning",
        default: "help"
    };

    const icon = iconMap[variant] || iconMap.default;

    return (
        <div className="confirm-modal__overlay" ref={overlayRef} onClick={handleOverlayClick}>
            <div className="confirm-modal">
                <div className={`confirm-modal__icon confirm-modal__icon--${variant}`}>
                    <Icon name={icon} />
                </div>
                <h3 className="confirm-modal__title">{title}</h3>
                {message && <p className="confirm-modal__message">{message}</p>}
                <div className="confirm-modal__actions">
                    <button className="confirm-modal__btn confirm-modal__btn--cancel" onClick={onCancel}>
                        {cancelLabel}
                    </button>
                    <button className={`confirm-modal__btn confirm-modal__btn--confirm confirm-modal__btn--${variant}`} onClick={onConfirm}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
