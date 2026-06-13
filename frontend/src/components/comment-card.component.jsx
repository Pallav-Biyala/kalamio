import { useContext, useState, useRef, useEffect } from "react";
import { getDay } from "../common/date";
import { UserContext } from "../App";
import toast from "react-hot-toast";
import { BlogContext } from "../pages/blog.page";
import api from "../common/api";
import Icon from "./Icon";
import Avatar from "./Avatar";
import { Link, useNavigate } from "react-router-dom";

const CommentCard = ({ index, commentData, isTextPost = false }) => {

    let { commented_by: { _id: commented_by_id, personal_info: { profile_img, fullname, username: commented_by_username } }, commentedAt, comment, images, poll, _id, children } = commentData

    let { blog, blog: { comments, activity, activity: { total_parent_comments }, comments: { results: commentsArr }, author: { personal_info: { username: blog_author } } }, setBlog, setTotalParentCommentsLoaded } = useContext(BlogContext)

    let { userAuth: { access_token, username, profile_img: my_profile_img, fullname: my_fullname } } = useContext(UserContext)
    const [ isReplying, setReplying ] = useState(false);
    const [ replyText, setReplyText ] = useState("");
    const replyTextareaRef = useRef(null);
    const navigate = useNavigate();

    // ── Like state ──
    const [ isLiked, setIsLiked ] = useState(false);
    const [ likesCount, setLikesCount ] = useState(commentData.activity?.total_likes || 0);

    // ── Three-dot menu state ──
    const [ showMenu, setShowMenu ] = useState(false);
    const [ isFollowingUser, setIsFollowingUser ] = useState(false);
    const [ followChecked, setFollowChecked ] = useState(false);
    const menuRef = useRef(null);

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowMenu(false);
            }
        };
        if (showMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showMenu]);

    // Check follow status when menu opens (only for non-owners)
    useEffect(() => {
        if (showMenu && !isOwner && access_token && !followChecked && commented_by_id) {
            api.post("/is-following", { user_id: commented_by_id })
            .then(({ data }) => {
                setIsFollowingUser(data.following || false);
                setFollowChecked(true);
            })
            .catch(() => {});
        }
    }, [showMenu]);

    // Check if user has liked this comment
    useEffect(() => {
        if (access_token && _id) {
            api.post("/is-comment-liked", { _id })
            .then(({ data: { result } }) => setIsLiked(!!result))
            .catch(() => {});
        }
    }, [_id, access_token]);

    // ── Preview replies state (text-post mode only) ──
    const [ previewReplies, setPreviewReplies ] = useState([]);
    const [ replyCount, setReplyCount ] = useState(children ? children.length : 0);
    const [ previewLoaded, setPreviewLoaded ] = useState(false);

    // Fetch preview replies for text-post mode
    useEffect(() => {
        if (isTextPost && children && children.length > 0 && !previewLoaded) {
            api.post("/get-preview-replies", { comment_id: _id })
            .then(({ data }) => {
                setPreviewReplies(data.replies || []);
                setReplyCount(data.reply_count || children.length);
                setPreviewLoaded(true);
            })
            .catch(() => {});
        }
    }, [_id, isTextPost, children?.length]);

    const isOwner = username === commented_by_username || username === blog_author;

    // ── Delete comment ──
    const deletComment = () => {
        setShowMenu(false);
        api.post("/delete-comment", { _id })
        .then(() => {
            const newArr = commentsArr.filter((c, i) => i !== index);
            if (commentData.childrenLevel == 0) {
                setTotalParentCommentsLoaded(preVal => preVal - 1)
            }
            setBlog({ ...blog, comments: { results: newArr }, activity: { ...activity, total_parent_comments: total_parent_comments - (commentData.childrenLevel == 0 ? 1 : 0) } })
        })
        .catch(() => {})
    }

    // ── Copy link ──
    const copyCommentLink = () => {
        setShowMenu(false);
        const link = `${window.location.origin}/comment/${_id}`;
        navigator.clipboard.writeText(link)
            .then(() => toast.success("Link copied"))
            .catch(() => toast.error("Failed to copy link"));
    }

    // ── Follow / Unfollow user ──
    const toggleFollow = () => {
        setShowMenu(false);
        if (!access_token) {
            return toast.error("Login first to follow");
        }
        if (!commented_by_id) return;
        const endpoint = isFollowingUser ? "/unfollow" : "/follow";
        api.post(endpoint, { user_id: commented_by_id })
        .then(() => {
            setIsFollowingUser(!isFollowingUser);
            toast.success(isFollowingUser ? "Unfollowed" : "Following");
        })
        .catch(() => toast.error("Something went wrong"));
    }

    // ── Like / Unlike comment ──
    const handleLike = () => {
        if (!access_token) {
            return toast.error("Login first to like");
        }
        api.post("/like-comment", { _id, isLikedByUser: isLiked })
        .then(({ data }) => {
            setIsLiked(data.liked_by_user);
            setLikesCount(data.total_likes);
        })
        .catch(() => toast.error("Something went wrong"));
    }

    // ── Reply handling ──
    const handleReplyClick = () => {
        if(!access_token){
            return toast.error("login first to leave a reply")
        }
        setReplying(true);
        setReplyText("");
    }

    useEffect(() => {
        if (isReplying && replyTextareaRef.current) {
            replyTextareaRef.current.focus();
        }
    }, [isReplying]);

    const handleReplySubmit = () => {
        if (!replyText.trim().length) return;

        api.post("/add-comment", {
            _id: blog._id, blog_author: blog.author._id, comment: replyText, replying_to: _id
        })
        .then(({ data }) => {
            setReplyText("");
            setReplying(false);

            data.commented_by = { personal_info: { username, profile_img: my_profile_img, fullname: my_fullname } }

            setReplyCount(prev => prev + 1);
            setPreviewReplies([data]);
            setPreviewLoaded(true);

            if (!commentData.children) commentData.children = [];
            commentData.children.push(data._id);

            setBlog({ ...blog, 
                comments: { ...comments, results: commentsArr },
                activity: { ...activity, total_comments: (activity.total_comments || 0) + 1 }
            });
        })
        .catch(() => {});
    }

    // ── Navigate to comment thread page (always for text-posts) ──
    const handleCommentClick = () => {
        if (isTextPost) {
            navigate(`/comment/${_id}`);
        }
    }

    // ── Render @mentions ──
    const renderText = (text) => {
        if (!text) return null;
        const parts = text.split(/(@[\w](?:[\w.]*[\w])?)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@') && part.length > 1) {
                const usernameRef = part.slice(1);
                return (
                    <Link key={i} to={`/user/${usernameRef}`} className="mention-link">
                        {part}
                    </Link>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    // ── Reply Preview sub-component (for text-post inline replies) ──
    const ReplyPreview = ({ reply }) => {
        if (!reply || !reply.commented_by) return null;
        const { personal_info: { profile_img: rImg, fullname: rName, username: rUsername } } = reply.commented_by;
        return (
            <div className="reply-preview" onClick={() => isTextPost && navigate(`/comment/${reply._id || _id}`)} style={{ cursor: isTextPost ? 'pointer' : 'default' }}>
                <div className="reply-preview__body">
                    <Link to={`/user/${rUsername}`} className="reply-preview__avatar" onClick={e => e.stopPropagation()}>
                        <Avatar src={rImg} alt={rUsername} size={28} />
                    </Link>
                    <div className="reply-preview__content">
                        <div className="reply-preview__meta">
                            <Link to={`/user/${rUsername}`} className="reply-preview__name" onClick={e => e.stopPropagation()}>{rName}</Link>
                            <span className="comment-card__dot">·</span>
                            <span className="reply-preview__time">{getDay(reply.commentedAt)}</span>
                        </div>
                        <p className="reply-preview__text">{renderText(reply.comment)}</p>
                        <div className="reply-preview__actions">
                            <button className="comment-card__action-btn">
                                <Icon name="favorite_border" />
                                <span>{reply.likes || 0}</span>
                            </button>
                            <button className="comment-card__action-btn">
                                <Icon name="chat_bubble_outline" />
                                <span>{reply.children?.length || ""}</span>
                            </button>
                            <button className="comment-card__action-btn">
                                <Icon name="repeat" />
                            </button>
                            <button className="comment-card__action-btn">
                                <Icon name="upload" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const hasPreview = isTextPost && previewLoaded && previewReplies.length > 0;

    // ── Three-dot menu component ──
    const ThreeDotMenu = () => (
        <div className="comment-card__menu-wrapper" ref={menuRef}>
            <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="comment-card__delete"
                title="More options"
            >
                <Icon name="more_horiz" className="text-lg" />
            </button>
            {showMenu && (
                <div className="comment-card__dropdown">
                    <button className="comment-card__dropdown-item" onClick={copyCommentLink}>
                        <Icon name="link" />
                        <span>Copy link</span>
                    </button>
                    {isOwner ? (
                        <button className="comment-card__dropdown-item comment-card__dropdown-item--danger" onClick={deletComment}>
                            <Icon name="delete" />
                            <span>Delete</span>
                        </button>
                    ) : (
                        <button className="comment-card__dropdown-item" onClick={toggleFollow}>
                            <Icon name={isFollowingUser ? "person_remove" : "person_add"} />
                            <span>{isFollowingUser ? "Following" : "Follow"}</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="comment-card">
            <div className={`comment-card__body ${hasPreview ? 'comment-card__body--threaded' : ''}`}>
                <div className="comment-card__avatar-col">
                    <Link to={`/user/${commented_by_username}`} className="comment-card__avatar">
                        <Avatar src={profile_img} alt={commented_by_username} size={32} />
                    </Link>
                    {hasPreview && <div className="comment-card__thread-line"></div>}
                </div>
                <div className="comment-card__content">
                    <div className="comment-card__meta">
                        <Link to={`/user/${commented_by_username}`} className="comment-card__name">{fullname}</Link>
                        <span className="comment-card__dot">·</span>
                        <span className="comment-card__time">{getDay(commentedAt)}</span>
                        {isTextPost && <ThreeDotMenu />}
                    </div>

                    {/* Comment text — always clickable in text-post mode */}
                    <div 
                        className={isTextPost ? "comment-card__text-clickable" : ""}
                        onClick={handleCommentClick}
                    >
                        <p className="comment-card__text">{renderText(comment)}</p>
                    </div>

                    {/* Images */}
                    {images && images.length > 0 && (
                        <div className={`feed-card__text-post-images feed-card__text-post-images--${Math.min(images.length, 4)} comment-card__media`}>
                            {images.map((url, i) => (
                                <img key={i} src={url} alt={`Image ${i + 1}`} className="feed-card__text-post-image" />
                            ))}
                        </div>
                    )}

                    {/* Poll */}
                    {poll && poll.options && poll.options.length > 0 && (
                        <div className="feed-card__text-post-poll comment-card__media">
                            {poll.question && (
                                <div className="feed-card__text-post-poll-header">
                                    <Icon name="bar_chart" className="feed-card__text-post-poll-icon" />
                                    <span className="feed-card__text-post-poll-question">{poll.question}</span>
                                </div>
                            )}
                            <div className="feed-card__text-post-poll-options">
                                {poll.options.map((opt, i) => (
                                    <div key={i} className="feed-card__text-post-poll-option">
                                        <div className="feed-card__text-post-poll-label">
                                            <span className="feed-card__text-post-poll-text">{opt.text}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="feed-card__text-post-poll-footer">
                                <Icon name="people_outline" className="text-sm" />
                                <span>{poll.total_votes || 0} vote{(poll.total_votes || 0) !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    )}

                    {/* Action bar */}
                    <div className="comment-card__actions">
                        <button className={`comment-card__action-btn ${isLiked ? 'comment-card__action-btn--liked' : ''}`} onClick={handleLike}>
                            <Icon name={isLiked ? "favorite" : "favorite_border"} filled={isLiked} />
                            <span>{likesCount || ""}</span>
                        </button>

                        <button className="comment-card__action-btn" onClick={handleReplyClick}>
                            <Icon name="chat_bubble_outline" />
                            <span>{replyCount || ""}</span>
                        </button>

                        <button className="comment-card__action-btn">
                            <Icon name="repeat" />
                            <span>{commentData.reshares || ""}</span>
                        </button>

                        <button className="comment-card__action-btn">
                            <Icon name="upload" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Text-post mode: inline preview replies ── */}
            {hasPreview && (
                <div className="comment-card__previews">
                    {previewReplies.map((reply, i) => (
                        <ReplyPreview key={reply._id || i} reply={reply} />
                    ))}
                </div>
            )}

            {/* Reply Modal */}
            {isReplying && (
                <div className="comment-modal-overlay" onClick={() => { setReplying(false); setReplyText(""); }}>
                    <div className="reply-modal" onClick={e => e.stopPropagation()}>
                        {/* Parent comment context */}
                        <div className="reply-modal__row">
                            <div className="reply-modal__left">
                                <Avatar src={profile_img} alt={commented_by_username} size={36} />
                                <div className="reply-modal__line"></div>
                            </div>
                            <div className="reply-modal__right">
                                <div className="reply-modal__header">
                                    <span className="reply-modal__name">{fullname}</span>
                                    <span className="reply-modal__time">{getDay(commentedAt)}</span>
                                </div>
                                <div className="reply-modal__text">{comment}</div>
                            </div>
                        </div>

                        {/* Current user reply */}
                        <div className="reply-modal__row" style={{ marginTop: '-4px' }}>
                            <div className="reply-modal__left">
                                <Avatar src={my_profile_img} alt={my_fullname} size={36} />
                            </div>
                            <div className="reply-modal__right">
                                <div className="reply-modal__name mb-1">{my_fullname}</div>
                                <textarea
                                    ref={replyTextareaRef}
                                    className="reply-modal__textarea"
                                    placeholder="Leave a reply..."
                                    value={replyText}
                                    onChange={(e) => {
                                        setReplyText(e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey && replyText.trim().length > 0) {
                                            e.preventDefault();
                                            handleReplySubmit();
                                        }
                                    }}
                                    rows={1}
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="reply-modal__footer">
                            <div></div>
                            <div className="reply-modal__actions">
                                <button className="reply-modal__cancel-btn" onClick={() => { setReplying(false); setReplyText(""); }}>
                                    Cancel
                                </button>
                                <button 
                                    className="reply-modal__post-btn"
                                    onClick={handleReplySubmit}
                                    disabled={!replyText.trim().length}
                                >
                                    Reply
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default CommentCard;