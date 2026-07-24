import { createPortal } from "react-dom";
import { useContext, useState, useEffect } from "react";
import { UserContext } from "../../App";
import { EditorContext } from "../../pages/editor.pages";
import Icon from "../Icon";
import DeviceFrame from "./DeviceFrame";
import ArticlePreview from "./ArticlePreview";
import ReelCardVisual from "../reel/ReelCardVisual";

const DEVICES = [
    { key: "laptop", label: "Laptop", icon: "laptop", width: "100%" },
    // The tablet glyph is shown landscape so it reads distinctly from the portrait phone (lucide's
    // Tablet and Smartphone are near-identical portrait rectangles otherwise).
    { key: "tablet", label: "Tablet", icon: "tablet_mac", width: 834, rotate: true },
    { key: "mobile", label: "Mobile", icon: "smartphone", width: 390 },
];

/**
 * Full-screen live preview of the article exactly as it will publish. Two modes: the reading page
 * ("Article", shown inside real device-width iframes so responsive breakpoints are accurate) and the
 * vertical Article Scroll reel ("Scroll card", the same component the feed uses). Layered over the
 * active publish phase; the editor stays mounted underneath, so closing loses no work. Reads the live
 * in-memory draft from EditorContext — no server round-trip.
 */
const PreviewOverlay = ({ onClose }) => {
    const { blog } = useContext(EditorContext);
    const { userAuth } = useContext(UserContext);
    const [mode, setMode] = useState("article"); // "article" | "scroll"
    const [device, setDevice] = useState("laptop");

    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        // Freeze background scroll while the preview is open.
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    // The published article credits the signed-in author and reads as "just now"; fill those in so the
    // preview looks like the real thing rather than an empty author row.
    const previewBlog = {
        ...blog,
        author: {
            personal_info: {
                fullname: userAuth?.fullname || userAuth?.username || "You",
                username: userAuth?.username || "you",
                profile_img: userAuth?.profile_img,
            },
        },
        publishedAt: null,
        activity: { total_likes: 0, total_comments: 0 },
        readTime: undefined,
    };

    const deviceWidth = DEVICES.find((d) => d.key === device)?.width ?? "100%";

    return createPortal(
        <div className="preview-overlay">
            <header className="preview-overlay__bar">
                <button className="preview-overlay__back" onClick={onClose} aria-label="Close preview">
                    <Icon name="arrow_back" className="text-xl" />
                    <span className="hidden sm:inline">Back</span>
                </button>

                <div className="preview-overlay__seg" data-active={mode} role="tablist" aria-label="Preview type">
                    <span className="preview-overlay__seg-thumb" aria-hidden="true" />
                    <button role="tab" aria-selected={mode === "article"}
                        className={mode === "article" ? "is-active" : ""} onClick={() => setMode("article")}>
                        <Icon name="article" className="text-base" /><span>Article</span>
                    </button>
                    <button role="tab" aria-selected={mode === "scroll"}
                        className={mode === "scroll" ? "is-active" : ""} onClick={() => setMode("scroll")}>
                        <Icon name="auto_stories" className="text-base" /><span>Scroll card</span>
                    </button>
                </div>

                {/* Device switcher — applies to BOTH Article and Scroll card. Only meaningful on a large
                    screen (on a phone you already ARE mobile), so it's hidden below lg. */}
                <div className="preview-overlay__devices" data-active={device}>
                    <span className="preview-overlay__devices-thumb" aria-hidden="true" />
                    {DEVICES.map((d) => (
                        <button key={d.key} className={device === d.key ? "is-active" : ""}
                            onClick={() => setDevice(d.key)} title={d.label} aria-label={d.label}>
                            <Icon name={d.icon} className="text-lg" style={d.rotate ? { transform: "rotate(90deg)" } : undefined} />
                        </button>
                    ))}
                </div>

                <span className="preview-overlay__pill">
                    <Icon name="visibility" className="text-sm" /> Preview
                </span>
            </header>

            <div className="preview-overlay__body">
                <DeviceFrame device={device} width={deviceWidth}>
                    {/* Keyed by mode + device so switching either tab or device remounts this and
                        retriggers the same fade — the page transition matches the toggle. */}
                    <div key={`${mode}-${device}`} className="preview-fade">
                        {mode === "article" ? (
                            <ArticlePreview blog={previewBlog} />
                        ) : (
                            // The reel is already viewport-responsive, so inside a device iframe it renders
                            // exactly as it would on that device (centered phone-card on laptop, full-width
                            // portrait on tablet, true phone reel on mobile). The dark stage stands in for
                            // the feed's background around the desktop card.
                            <div className="preview-reel-stage">
                                <ReelCardVisual blog={previewBlog} interactive={false}>
                                    {/* Static, non-interactive rail — for visual completeness only. */}
                                    <div className="reel-card__actions reel-card__actions--static" aria-hidden="true">
                                        <span className="reel-card__action-btn"><Icon name="favorite_border" /><span>0</span></span>
                                        <span className="reel-card__action-btn"><Icon name="chat_bubble_outline" /><span>0</span></span>
                                        <span className="reel-card__action-btn"><Icon name="bookmark_border" /><span>Save</span></span>
                                        <span className="reel-card__action-btn"><Icon name="share" /><span>Share</span></span>
                                        <span className="reel-card__read-btn"><Icon name="auto_stories" /><span>Read</span></span>
                                    </div>
                                </ReelCardVisual>
                            </div>
                        )}
                    </div>
                </DeviceFrame>
            </div>
        </div>,
        document.body
    );
};

export default PreviewOverlay;
