import { useState, useRef, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { UserContext } from "../App";
import toast from "react-hot-toast";
import api from "../common/api";

const PostMenu = ({ blogId, authorUsername, postType, onEdit, onSaveToCollection }) => {
    const [open, setOpen] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const menuRef = useRef(null);
    const navigate = useNavigate();
    const { userAuth: { username, access_token } } = useContext(UserContext);

    const isOwner = username === authorUsername;

    // Check saved status every time the menu is opened
    useEffect(() => {
        if (!access_token || !blogId || !open) return;
        api.post("/collection/is-saved", { blog_id: blogId })
            .then(({ data }) => setIsSaved(data.saved))
            .catch(() => {});
    }, [access_token, blogId, open]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handleKey = (e) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [open]);

    const copyLink = () => {
        const url = `${window.location.origin}/blog/${blogId}`;
        navigator.clipboard.writeText(url)
            .then(() => toast.success("Link copied!"))
            .catch(() => toast.error("Failed to copy"));
        setOpen(false);
    };

    const handleEdit = () => {
        setOpen(false);
        if (postType === 'text_post' && onEdit) {
            onEdit(blogId);
        } else {
            navigate(`/editor/${blogId}`);
        }
    };

    const handleDelete = () => {
        if (!window.confirm("Are you sure you want to delete this post?")) return;
        api.post("/delete-blog", { blog_id: blogId })
            .then(() => {
                toast.success("Post deleted");
                // Remove from DOM by reloading — simplest approach
                window.location.reload();
            })
            .catch((err) => {
                toast.error(err?.response?.data?.error || "Failed to delete");
            });
        setOpen(false);
    };

    const handleFollow = () => {
        if (!access_token) {
            toast.error("Please sign in to follow");
            setOpen(false);
            return;
        }
        api.post("/follow", { username: authorUsername })
            .then(({ data }) => {
                toast.success(data.message || `Followed @${authorUsername}`);
            })
            .catch((err) => {
                toast.error(err?.response?.data?.error || "Failed to follow");
            });
        setOpen(false);
    };

    const handleQuickSave = () => {
        if (!access_token) {
            toast.error("Please sign in to save");
            setOpen(false);
            return;
        }
        api.post("/collection/quick-save", { blog_id: blogId })
            .then(({ data }) => {
                setIsSaved(data.saved);
                toast.success(data.saved ? "Saved to Read Later" : "Removed from Read Later");
            })
            .catch(() => toast.error("Failed to save"));
        setOpen(false);
    };

    const handleSaveToCollection = () => {
        if (!access_token) {
            toast.error("Please sign in to save");
            setOpen(false);
            return;
        }
        setOpen(false);
        if (onSaveToCollection) onSaveToCollection();
    };

    return (
        <div className="post-menu" ref={menuRef}>
            <button
                className="feed-card__menu"
                aria-label="More options"
                onClick={() => setOpen(!open)}
            >
                <Icon name="more_horiz" />
            </button>

            {open && (
                <div className="post-menu__dropdown">
                    {/* Save to Read Later */}
                    <button className="post-menu__item" onClick={handleQuickSave}>
                        <Icon name="bookmark" filled={isSaved} />
                        <span>{isSaved ? 'Saved to Read Later' : 'Save to Read Later'}</span>
                    </button>

                    {/* Save to collection */}
                    <button className="post-menu__item" onClick={handleSaveToCollection}>
                        <Icon name="playlist_add" />
                        <span>Save to collection</span>
                    </button>

                    <div className="post-menu__divider" />

                    {/* Copy Link — always shown */}
                    <button className="post-menu__item" onClick={copyLink}>
                        <Icon name="link" />
                        <span>Copy link</span>
                    </button>

                    {isOwner ? (
                        <>
                            <button className="post-menu__item" onClick={handleEdit}>
                                <Icon name="edit" />
                                <span>Edit</span>
                            </button>
                            <button className="post-menu__item post-menu__item--danger" onClick={handleDelete}>
                                <Icon name="delete" />
                                <span>Delete</span>
                            </button>
                        </>
                    ) : (
                        <button className="post-menu__item" onClick={handleFollow}>
                            <Icon name="person_add" />
                            <span>Follow</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default PostMenu;
