import { useState, useRef, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { UserContext } from "../App";
import { useArticleCollections } from "../hooks/queries";
import toast from "react-hot-toast";
import api from "../common/api";

const PostMenu = ({ blogId, authorUsername, postType, onEdit, onSaveToCollection }) => {
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);
    const navigate = useNavigate();
    const { userAuth: { username, access_token } } = useContext(UserContext);

    const isOwner = username === authorUsername;

    // Fetch collections only once the menu opens — this fills the Save icon when the article is already
    // saved, and warms the cache so the Save modal opens instantly instead of loading from scratch.
    const { data: articleCollections } = useArticleCollections(blogId, { enabled: open });
    const isSaved = !!articleCollections?.some(c => c.contains_article);

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
                    {/* Save to collection — auto-adds to "Read Later" on open, then lets you organize */}
                    <button className="post-menu__item" onClick={handleSaveToCollection}>
                        <Icon name="bookmark" filled={isSaved} />
                        <span>{isSaved ? 'Saved to collection' : 'Save to collection'}</span>
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
