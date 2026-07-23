import { useContext, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { UserContext } from "../App";
import toast from "react-hot-toast";
import api from "../common/api";
import { BlogContext } from "../pages/blog.page";
import { getDay } from "../common/date";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../common/queryKeys";
import ConfirmModal from "./confirm-modal.component";

const CommentField = ({ action, index = undefined, replyingTo = undefined, setReplying, defaultOpen = false, onClose, customBlogData, onCommentPosted }) => {

    let blogContext = useContext(BlogContext);
    const queryClient = useQueryClient();
    
    // Fallback to custom data if used outside of blog details (e.g. in feed)
    let blogData = customBlogData || (blogContext ? blogContext.blog : null);

    let { userAuth: { access_token, username, profile_img, fullname } } = useContext(UserContext);

    const [ comment, setComment ] = useState("");
    const [ showModal, setShowModal ] = useState(defaultOpen);
    const [ isSubmitting, setIsSubmitting ] = useState(false);
    const [ showDiscardConfirm, setShowDiscardConfirm ] = useState(false);
    const textareaRef = useRef(null);
    const modalRef = useRef(null);

    // Mentions state
    const [ mentionQuery, setMentionQuery ] = useState("");
    const [ showMentions, setShowMentions ] = useState(false);
    const [ mentionResults, setMentionResults ] = useState([]);
    const [ mentionIndex, setMentionIndex ] = useState(-1);
    const mentionTimeoutRef = useRef(null);

    const isReply = action === 'reply';

    useEffect(() => {
        if (defaultOpen !== undefined) setShowModal(defaultOpen);
    }, [defaultOpen]);

    useEffect(() => {
        if (showModal && textareaRef.current) {
            textareaRef.current.focus();
        }

        // Lock body scroll when open — and reserve the scrollbar's width as padding so that
        // removing it doesn't shift the (blurred) background sideways as the modal opens.
        if (showModal && !isReply) {
            const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
            if (scrollbarW > 0) document.body.style.paddingRight = `${scrollbarW}px`;
        } else {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            document.body.style.paddingRight = '';
        }

        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            document.body.style.paddingRight = '';
        };
    }, [showModal, isReply]);

    const fetchMentions = async (query) => {
        try {
            const { data } = await api.post("/search-connections-follows", { query });
            setMentionResults(data.users || []);
        } catch (err) {
            setMentionResults([]);
        }
    };

    const detectMention = (textarea) => {
        const val = textarea.value;
        const cursorPosition = textarea.selectionStart;
        const textBeforeCursor = val.slice(0, cursorPosition);
        const match = textBeforeCursor.match(/(?:^|[\s\n])@([\w.]*)$/);
        
        if (match) {
            const query = match[1];
            setMentionQuery(query);
            setShowMentions(true);
            setMentionIndex(textBeforeCursor.lastIndexOf("@"));
            
            clearTimeout(mentionTimeoutRef.current);
            mentionTimeoutRef.current = setTimeout(() => {
                fetchMentions(query);
            }, 300);
        } else {
            setShowMentions(false);
        }
    };

    const handleMentionIconClick = () => {
        if (!textareaRef.current) return;
        const cursorPosition = textareaRef.current.selectionStart;
        const textBefore = comment.slice(0, cursorPosition);
        const textAfter = comment.slice(cursorPosition);
        
        setComment(`${textBefore}@${textAfter}`);
        
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(cursorPosition + 1, cursorPosition + 1);
                detectMention(textareaRef.current);
            }
        }, 0);
    };

    const insertMention = (username) => {
        const textBefore = comment.slice(0, mentionIndex);
        const afterMentionPos = mentionIndex + 1 + mentionQuery.length;
        const textAfter = comment.slice(afterMentionPos);
        const newText = `${textBefore}@${username} ${textAfter}`;
        
        setComment(newText);
        setShowMentions(false);
        setMentionResults([]);
        
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const newPos = textBefore.length + username.length + 2;
                textareaRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };

    const handleCursorMove = (e) => {
        detectMention(e.target);
    };

    const handleComment = () => {

        // In-flight guard — a second Enter/click while the POST is pending would
        // otherwise create a duplicate comment.
        if(isSubmitting) return;

        if(!access_token){
            return toast.error("login first to leave a comment");
        }

        if(!comment.length){
            return toast.error("Write something to leave a comment")
        }

        if(!blogData) return;

        let _id = blogData._id;
        let blog_author = blogData.author._id;

        setIsSubmitting(true);

        api.post("/add-comment", {
            _id, blog_author, comment, replying_to: replyingTo
        })
        .then(({ data }) => {

            setComment("");
            setShowModal(false);
            if (onClose) onClose();

            data.commented_by = { personal_info: { username, profile_img, fullname } }

            if (onCommentPosted) {
                onCommentPosted(data);
            }

            if (blogContext && blogContext.setBlog) {
                let newCommentArr;
                let commentsArr = blogContext.blog.comments?.results || [];
                let activity = blogContext.blog.activity || { total_comments: 0, total_parent_comments: 0 };
                let total_comments = activity.total_comments;
                let total_parent_comments = activity.total_parent_comments;

                if(replyingTo && index !== undefined){
                    commentsArr[index].children.push(data._id);
                    data.childrenLevel = commentsArr[index].childrenLevel + 1;
                    data.parentIndex = index;
                    commentsArr[index].isReplyLoaded = true;
                    commentsArr.splice(index + 1, 0, data);
                    newCommentArr = commentsArr;
                    if (setReplying) setReplying(false);
                } else {
                    data.childrenLevel = 0;
                    newCommentArr = [ data, ...commentsArr ];
                }

                let parentCommentIncrementVal = replyingTo ? 0 : 1;

                // Functional form so a concurrent live activity update (e.g. someone else liking the
                // post while this comment is in flight) isn't reverted by a stale-closure snapshot.
                blogContext.setBlog(prev => ({ ...prev,
                    comments: { ...prev.comments, results: newCommentArr },
                    activity: { ...prev.activity,
                        total_comments: (prev.activity?.total_comments || 0) + 1,
                        total_parent_comments: (prev.activity?.total_parent_comments || 0) + parentCommentIncrementVal
                    }
                }));

                if (blogContext.setTotalParentCommentsLoaded) {
                    blogContext.setTotalParentCommentsLoaded(preVal => preVal + parentCommentIncrementVal);
                }
            }

            // Invalidate feed queries so count syncs across tabs
            queryClient.invalidateQueries({ queryKey: queryKeys.blogs.all() });
        })
        .catch(err => {
            toast.error(err.message || "Failed to post comment");
        })
        .finally(() => {
            setIsSubmitting(false);
        })

    }

    const openModal = () => {
        if (!access_token) {
            return toast.error("login first to leave a comment");
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowDiscardConfirm(false);
        setShowModal(false);
        setComment("");
        if (onClose) onClose();
    };

    // Dismiss gesture (overlay click / Escape / Cancel). Never throws away a typed
    // draft silently — asks first when there is something to lose.
    const requestClose = () => {
        if (isSubmitting) return;
        if (comment.trim().length) {
            setShowDiscardConfirm(true);
            return;
        }
        closeModal();
    };

    // Escape closes the modal (via the draft-safe path) and Tab is trapped inside it.
    useEffect(() => {
        if (!showModal || isReply) return;

        const handleKeyDown = (e) => {
            // While the discard confirmation is up it owns Escape.
            if (showDiscardConfirm) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                if (showMentions) {
                    setShowMentions(false);
                } else {
                    requestClose();
                }
                return;
            }

            if (e.key === 'Tab' && modalRef.current) {
                const focusable = modalRef.current.querySelectorAll(
                    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
                );
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal, isReply, showMentions, showDiscardConfirm, comment, isSubmitting]);

    if(!blogData) return null;

    // ── Inline reply mode (inside comment cards) ──
    if (isReply) {
        return (
            <div className="comment-input comment-input--reply">
                <Avatar src={profile_img} alt={username} size={28} />
                <div className="comment-input__box comment-input__box--active">
                    <textarea 
                        value={comment} 
                        ref={textareaRef}
                        autoFocus
                        onChange={(e) => {
                            setComment(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                            detectMention(e.target);
                        }}
                        onClick={handleCursorMove}
                        onKeyUp={handleCursorMove}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey && comment.trim().length > 0 && !isSubmitting) {
                                e.preventDefault();
                                handleComment();
                            }
                        }}
                        placeholder="Leave a reply..."
                        className="comment-input__textarea"
                        rows={1}
                    />
                    
                    {showMentions && (
                        <div className="mention-dropdown">
                            <div className="mention-dropdown__header">
                                <Icon name="search" className="mention-dropdown__search-icon" />
                                <input 
                                    type="text" 
                                    className="mention-dropdown__search-input" 
                                    placeholder="Search people..."
                                    value={mentionQuery}
                                    onChange={(e) => {
                                        setMentionQuery(e.target.value);
                                        clearTimeout(mentionTimeoutRef.current);
                                        mentionTimeoutRef.current = setTimeout(() => {
                                            fetchMentions(e.target.value);
                                        }, 300);
                                    }}
                                />
                                <button className="mention-dropdown__close" onClick={() => setShowMentions(false)}>
                                    <Icon name="close" className="text-base" />
                                </button>
                            </div>
                            <div className="mention-dropdown__list">
                                {mentionResults.length > 0 ? (
                                    mentionResults.map((user, i) => (
                                        <div 
                                            key={i} 
                                            className="mention-dropdown__item"
                                            onClick={() => insertMention(user.personal_info.username)}
                                        >
                                            <Avatar src={user.personal_info.profile_img} alt={user.personal_info.fullname} size={28} />
                                            <div className="mention-dropdown__info">
                                                <span className="mention-dropdown__fullname">{user.personal_info.fullname}</span>
                                                <span className="mention-dropdown__username">@{user.personal_info.username}</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-3 text-center text-sm text-dark-grey">No users found</div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="comment-input__actions">
                        <div className="flex gap-2 mr-auto">
                            <button
                                className="tp-composer__tool-btn p-1 flex items-center justify-center hover:bg-grey rounded-full transition-colors"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleMentionIconClick();
                                }}
                                title="Mention someone"
                            >
                                <Icon name="alternate_email" />
                            </button>
                        </div>
                        <button 
                            className="comment-input__cancel"
                            onClick={() => { setComment(""); if (setReplying) setReplying(false); }}
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleComment}
                            className="comment-input__submit"
                            disabled={!comment.trim().length || isSubmitting}
                        >
                            {isSubmitting ? "Posting…" : "Reply"}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Top-level comment stub + modal ──
    return (
        <>
            {/* Trigger stub — ONLY for inline (blog-detail) usage. In the feed the modal is
                opened directly (defaultOpen), so rendering the stub there would inject an
                element into the transformed feed card and shift its layout as the modal opens.
                The card's own comment button is the trigger there, so the stub isn't needed. */}
            {!defaultOpen && (
                <div className="comment-input" onClick={openModal} id="comment-textarea">
                    <Avatar src={profile_img} alt={username} size={32} />
                    <div className="comment-input__box comment-input__box--stub">
                        <span className="comment-input__placeholder">Leave a comment...</span>
                    </div>
                </div>
            )}

            {/* Comment Modal — portaled to <body> so its fixed overlay escapes the feed
                card's framer-motion transform. A fixed element inside a transformed ancestor
                anchors to that ancestor (not the viewport), which caused the corner→center
                glitch; at <body> it centers smoothly like the text-post composer. */}
            {showModal && createPortal(
                <>
                <div className="comment-modal-overlay" onClick={requestClose}>
                    <div
                        className="reply-modal"
                        ref={modalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Leave a comment"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Parent Row - Blog author context */}
                        <div className="reply-modal__row">
                            <div className="reply-modal__left">
                                <Avatar 
                                    src={blogData.author.personal_info.profile_img} 
                                    alt={blogData.author.personal_info.fullname} 
                                    size={36} 
                                />
                                <div className="reply-modal__line"></div>
                            </div>
                            <div className="reply-modal__right">
                                <div className="reply-modal__header">
                                    <span className="reply-modal__name">
                                        {blogData.author.personal_info.fullname}
                                    </span>
                                    {blogData.publishedAt && (
                                        <span className="reply-modal__time">
                                            {getDay(blogData.publishedAt)}
                                        </span>
                                    )}
                                </div>
                                <div className="reply-modal__text">
                                    {blogData.text_content || blogData.title}
                                </div>
                            </div>
                        </div>

                        {/* Current User Row */}
                        <div className="reply-modal__row" style={{ marginTop: '-4px' }}>
                            <div className="reply-modal__left">
                                <Avatar src={profile_img} alt={fullname} size={36} />
                            </div>
                            <div className="reply-modal__right">
                                <div className="reply-modal__name mb-1">{fullname}</div>
                                <textarea
                                    ref={textareaRef}
                                    className="reply-modal__textarea"
                                    placeholder="Leave a comment..."
                                    value={comment}
                                    onChange={(e) => {
                                        setComment(e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                        detectMention(e.target);
                                    }}
                                    onClick={handleCursorMove}
                                    onKeyUp={handleCursorMove}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey && comment.trim().length > 0 && !isSubmitting) {
                                            e.preventDefault();
                                            handleComment();
                                        }
                                    }}
                                    rows={1}
                                />
                            </div>
                        </div>

                        {showMentions && (
                            <div className="mention-dropdown">
                                <div className="mention-dropdown__header">
                                    <Icon name="search" className="mention-dropdown__search-icon" />
                                    <input 
                                        type="text" 
                                        className="mention-dropdown__search-input" 
                                        placeholder="Search people..."
                                        value={mentionQuery}
                                        onChange={(e) => {
                                            setMentionQuery(e.target.value);
                                            clearTimeout(mentionTimeoutRef.current);
                                            mentionTimeoutRef.current = setTimeout(() => {
                                                fetchMentions(e.target.value);
                                            }, 300);
                                        }}
                                    />
                                    <button className="mention-dropdown__close" onClick={() => setShowMentions(false)}>
                                        <Icon name="close" className="text-base" />
                                    </button>
                                </div>
                                <div className="mention-dropdown__list">
                                    {mentionResults.length > 0 ? (
                                        mentionResults.map((user, i) => (
                                            <div 
                                                key={i} 
                                                className="mention-dropdown__item"
                                                onClick={() => insertMention(user.personal_info.username)}
                                            >
                                                <Avatar src={user.personal_info.profile_img} alt={user.personal_info.fullname} size={28} />
                                                <div className="mention-dropdown__info">
                                                    <span className="mention-dropdown__fullname">{user.personal_info.fullname}</span>
                                                    <span className="mention-dropdown__username">@{user.personal_info.username}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-3 text-center text-sm text-dark-grey">No users found</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="reply-modal__footer">
                            <div className="flex gap-2">
                                <button
                                    className="tp-composer__tool-btn p-1 flex items-center justify-center hover:bg-grey rounded-full transition-colors"
                                    onClick={handleMentionIconClick}
                                    title="Mention someone"
                                >
                                    <Icon name="alternate_email" />
                                </button>
                            </div>
                            <div className="reply-modal__actions">
                                <button className="reply-modal__cancel-btn" onClick={requestClose}>
                                    Cancel
                                </button>
                                <button
                                    className="reply-modal__post-btn"
                                    onClick={handleComment}
                                    disabled={!comment.trim().length || isSubmitting}
                                >
                                    {isSubmitting ? "Posting…" : "Post"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <ConfirmModal
                    isOpen={showDiscardConfirm}
                    title="Discard comment?"
                    message="You have unsaved text. Closing now will discard it."
                    confirmLabel="Discard"
                    cancelLabel="Keep editing"
                    variant="danger"
                    onConfirm={closeModal}
                    onCancel={() => setShowDiscardConfirm(false)}
                />
                </>,
                document.body
            )}
        </>
    );
}

export default CommentField;