import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import Icon from "./Icon";

const DISMISS_THRESHOLD = 0.6; // 60% off-screen = dismissed
const EDGE_MARGIN = 12;
const BUTTON_SIZE = 52;
const TAB_BAR_HEIGHT = 80;
const CREATE_FAB_SIZE = 56;

const FeedbackButton = () => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const location = useLocation();

    // Drag state (refs to avoid re-renders during drag — keeps it 60fps)
    const fabRef = useRef(null);
    const isDragging = useRef(false);
    const hasMoved = useRef(false);
    const startTouch = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });
    const currentPos = useRef({ x: 0, y: 0 });
    const velocity = useRef({ x: 0, y: 0 });
    const lastTouch = useRef({ x: 0, y: 0, time: 0 });

    const isMobile = () => window.innerWidth < 1024;

    // Reset dismissed state when navigating to home
    useEffect(() => {
        if (location.pathname === "/") {
            setDismissed(false);
        }
    }, [location.pathname]);



    // Show tooltip briefly on first load
    useEffect(() => {
        if (dismissed) return;
        const hasSeen = sessionStorage.getItem("feedback_tooltip_seen");
        if (!hasSeen) {
            const timer = setTimeout(() => {
                setShowTooltip(true);
                sessionStorage.setItem("feedback_tooltip_seen", "true");
            }, 3000);

            const hideTimer = setTimeout(() => {
                setShowTooltip(false);
            }, 8000);

            return () => {
                clearTimeout(timer);
                clearTimeout(hideTimer);
            };
        }
    }, [dismissed]);

    // Set initial position on mobile
    useEffect(() => {
        if (!fabRef.current || !isMobile()) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // Default: bottom-right, directly above the + FAB
        const x = vw - BUTTON_SIZE - 20 + (CREATE_FAB_SIZE - BUTTON_SIZE) / 2;
        const y = vh - TAB_BAR_HEIGHT - CREATE_FAB_SIZE - BUTTON_SIZE - 24;
        currentPos.current = { x, y };
        fabRef.current.style.left = `${x}px`;
        fabRef.current.style.top = `${y}px`;
    }, [dismissed]);

    // Snap to nearest edge after drag
    const snapToEdge = useCallback((x, y) => {
        const el = fabRef.current;
        if (!el) return;

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const midX = vw / 2;

        // Snap to left or right edge
        let snapX = x + BUTTON_SIZE / 2 < midX ? EDGE_MARGIN : vw - BUTTON_SIZE - EDGE_MARGIN;
        // Clamp Y within safe bounds
        const minY = EDGE_MARGIN + 50; // below status bar area
        const maxY = vh - TAB_BAR_HEIGHT - BUTTON_SIZE - EDGE_MARGIN;
        let snapY = Math.max(minY, Math.min(y, maxY));

        // ── Avoid the Create FAB (+) zone (bottom-right) ──
        // The + button is roughly: right:20px, bottom:90px, size:56x56
        const fabZone = {
            left: vw - 20 - 56 - 16,   // 16px padding around the FAB
            top: vh - TAB_BAR_HEIGHT - 56 - 16,
            right: vw,
            bottom: vh - TAB_BAR_HEIGHT + 16,
        };

        const wouldOverlap =
            snapX + BUTTON_SIZE > fabZone.left &&
            snapX < fabZone.right &&
            snapY + BUTTON_SIZE > fabZone.top &&
            snapY < fabZone.bottom;

        if (wouldOverlap) {
            // Nudge above the FAB zone
            snapY = fabZone.top - BUTTON_SIZE - 12;
            snapY = Math.max(minY, snapY);
        }

        currentPos.current = { x: snapX, y: snapY };

        el.style.transition = "left 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease";
        el.style.left = `${snapX}px`;
        el.style.top = `${snapY}px`;
        el.style.opacity = "1";

        setTimeout(() => {
            if (el) el.style.transition = "";
        }, 400);
    }, []);

    // Check if button was flung off-screen
    const checkDismiss = useCallback((x, y, vx, vy) => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const offLeft = x < -BUTTON_SIZE * DISMISS_THRESHOLD;
        const offRight = x > vw - BUTTON_SIZE * (1 - DISMISS_THRESHOLD);
        const offTop = y < -BUTTON_SIZE * DISMISS_THRESHOLD;
        const offBottom = y > vh - BUTTON_SIZE * (1 - DISMISS_THRESHOLD);

        // Also check velocity — fast fling counts as dismiss
        const speed = Math.sqrt(vx * vx + vy * vy);
        const flung = speed > 1.5 && (offLeft || offRight || offTop || offBottom ||
            x < BUTTON_SIZE || x > vw - BUTTON_SIZE * 2 ||
            y < BUTTON_SIZE || y > vh - BUTTON_SIZE * 2);

        return offLeft || offRight || offTop || offBottom || flung;
    }, []);

    // Animate dismiss (slide off + fade)
    const animateDismiss = useCallback((x, y, vx, vy) => {
        const el = fabRef.current;
        if (!el) return;

        const speed = Math.sqrt(vx * vx + vy * vy);
        const dirX = speed > 0 ? vx / speed : (x < window.innerWidth / 2 ? -1 : 1);
        const dirY = speed > 0 ? vy / speed : 0;

        const targetX = x + dirX * 200;
        const targetY = y + dirY * 200;

        el.style.transition = "left 0.3s ease-out, top 0.3s ease-out, opacity 0.25s ease-out";
        el.style.left = `${targetX}px`;
        el.style.top = `${targetY}px`;
        el.style.opacity = "0";

        setTimeout(() => {
            setDismissed(true);
        }, 300);
    }, []);

    // Touch handlers
    const onTouchStart = useCallback((e) => {
        if (!isMobile()) return;
        const touch = e.touches[0];

        isDragging.current = true;
        hasMoved.current = false;
        startTouch.current = { x: touch.clientX, y: touch.clientY };
        startPos.current = { ...currentPos.current };
        lastTouch.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
        velocity.current = { x: 0, y: 0 };

        setShowTooltip(false);

        if (fabRef.current) {
            fabRef.current.style.transition = "";
            fabRef.current.style.transform = "scale(1.1)";
        }
    }, []);

    const onTouchMove = useCallback((e) => {
        if (!isDragging.current || !fabRef.current) return;
        e.preventDefault();

        const touch = e.touches[0];
        const dx = touch.clientX - startTouch.current.x;
        const dy = touch.clientY - startTouch.current.y;

        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
            hasMoved.current = true;
        }

        const newX = startPos.current.x + dx;
        const newY = startPos.current.y + dy;
        currentPos.current = { x: newX, y: newY };

        fabRef.current.style.left = `${newX}px`;
        fabRef.current.style.top = `${newY}px`;

        // Fade as it approaches edges
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const edgeDist = Math.min(
            newX + BUTTON_SIZE,
            vw - newX,
            newY + BUTTON_SIZE,
            vh - newY
        );
        const opacity = Math.max(0.3, Math.min(1, edgeDist / (BUTTON_SIZE * 1.5)));
        fabRef.current.style.opacity = `${opacity}`;

        // Track velocity
        const now = Date.now();
        const dt = now - lastTouch.current.time;
        if (dt > 0) {
            velocity.current = {
                x: (touch.clientX - lastTouch.current.x) / dt,
                y: (touch.clientY - lastTouch.current.y) / dt,
            };
        }
        lastTouch.current = { x: touch.clientX, y: touch.clientY, time: now };
    }, []);

    const onTouchEnd = useCallback(() => {
        if (!isDragging.current) return;
        isDragging.current = false;

        if (fabRef.current) {
            fabRef.current.style.transform = "";
        }

        const { x, y } = currentPos.current;
        const { x: vx, y: vy } = velocity.current;

        if (checkDismiss(x, y, vx, vy)) {
            animateDismiss(x, y, vx, vy);
        } else {
            snapToEdge(x, y);
        }
    }, [checkDismiss, animateDismiss, snapToEdge]);

    // Attach touch listeners (non-passive for preventDefault)
    useEffect(() => {
        const el = fabRef.current;
        if (!el) return;

        el.addEventListener("touchstart", onTouchStart, { passive: true });
        el.addEventListener("touchmove", onTouchMove, { passive: false });
        el.addEventListener("touchend", onTouchEnd, { passive: true });

        return () => {
            el.removeEventListener("touchstart", onTouchStart);
            el.removeEventListener("touchmove", onTouchMove);
            el.removeEventListener("touchend", onTouchEnd);
        };
    }, [onTouchStart, onTouchMove, onTouchEnd, dismissed]);

    const handleClick = () => {
        // If the user dragged, don't open the link
        if (hasMoved.current) return;
        setHasInteracted(true);
        setShowTooltip(false);
        window.open("https://www.candiq.app/feedback/kwhVipb1", "_blank", "noopener,noreferrer");
    };

    if (dismissed) return null;

    return (
        <div className="feedback-fab" ref={fabRef}>
            {/* Tooltip */}
            {showTooltip && (
                <div className="feedback-fab__tooltip">
                    <span>Found a bug or love something? Share feedback!</span>
                    <button
                        className="feedback-fab__tooltip-close"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowTooltip(false);
                        }}
                        aria-label="Dismiss"
                    >
                        <Icon name="close" className="text-sm" />
                    </button>
                </div>
            )}

            {/* FAB Button */}
            <button
                className={`feedback-fab__button ${!hasInteracted ? "feedback-fab__button--pulse" : ""}`}
                onClick={handleClick}
                onMouseEnter={() => !showTooltip && setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                aria-label="Send Feedback"
                id="feedback-button"
            >
                <Icon name="feedback" className="text-2xl" />
            </button>
        </div>
    );
};

export default FeedbackButton;
