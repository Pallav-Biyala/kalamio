import { useContext, useState, useRef, useEffect } from "react";
import { UserContext } from "../App";
import toast from "react-hot-toast";
import api from "../common/api";
import { BlogContext } from "../pages/blog.page";
import { getDay } from "../common/date";
import Avatar from "./Avatar";

const CommentField = ({ action, index = undefined, replyingTo = undefined, setReplying }) => {

    let { blog, blog: { _id, author: { _id: blog_author }, comments, comments: { results: commentsArr }, activity, activity: { total_comments, total_parent_comments } }, setBlog, setTotalParentCommentsLoaded } = useContext(BlogContext);

    let { userAuth: { access_token, username, profile_img, fullname } } = useContext(UserContext);

    const [ comment, setComment ] = useState("");
    const [ showModal, setShowModal ] = useState(false);
    const textareaRef = useRef(null);

    const isReply = action === 'reply';

    useEffect(() => {
        if (showModal && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [showModal]);

    const handleComment = () => {

        if(!access_token){
            return toast.error("login first to leave a comment");
        }

        if(!comment.length){
            return toast.error("Write something to leave a comment")
        }

        api.post("/add-comment", {
            _id, blog_author, comment, replying_to: replyingTo
        })
        .then(({ data }) => {
            
            setComment("");
            setShowModal(false);

            data.commented_by = { personal_info: { username, profile_img, fullname } }

            let newCommentArr;

            if(replyingTo){
                
                commentsArr[index].children.push(data._id);

                data.childrenLevel = commentsArr[index].childrenLevel + 1;
                data.parentIndex = index;

                commentsArr[index].isReplyLoaded = true;

                commentsArr.splice(index + 1, 0, data);

                newCommentArr = commentsArr;

                if (setReplying) setReplying(false);

            } else{
                data.childrenLevel = 0;
                newCommentArr = [ data, ...commentsArr ];
            }

            let parentCommentIncrementVal = replyingTo ? 0 : 1;

            setBlog({ ...blog, 
                comments: { ...comments, results: newCommentArr }, 
                activity: { ...activity, 
                    total_comments: total_comments + 1, 
                    total_parent_comments: total_parent_comments + parentCommentIncrementVal 
                } 
            })

            setTotalParentCommentsLoaded(preVal => preVal + parentCommentIncrementVal)

        })
        .catch(err => {
        })

    }

    const openModal = () => {
        if (!access_token) {
            return toast.error("login first to leave a comment");
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setComment("");
    };

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
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey && comment.trim().length > 0) {
                                e.preventDefault();
                                handleComment();
                            }
                        }}
                        placeholder="Leave a reply..."
                        className="comment-input__textarea"
                        rows={1}
                    />
                    <div className="comment-input__actions">
                        <button 
                            className="comment-input__cancel"
                            onClick={() => { setComment(""); if (setReplying) setReplying(false); }}
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleComment}
                            className="comment-input__submit"
                            disabled={!comment.trim().length}
                        >
                            Reply
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Top-level comment stub + modal ──
    return (
        <>
            {/* Clickable stub — no layout shift */}
            <div className="comment-input" onClick={openModal} id="comment-textarea">
                <Avatar src={profile_img} alt={username} size={32} />
                <div className="comment-input__box comment-input__box--stub">
                    <span className="comment-input__placeholder">Leave a comment...</span>
                </div>
            </div>

            {/* Comment Modal */}
            {showModal && (
                <div className="comment-modal-overlay" onClick={closeModal}>
                    <div className="reply-modal" onClick={e => e.stopPropagation()}>
                        {/* Parent Row - Blog author context */}
                        <div className="reply-modal__row">
                            <div className="reply-modal__left">
                                <Avatar 
                                    src={blog.author.personal_info.profile_img} 
                                    alt={blog.author.personal_info.fullname} 
                                    size={36} 
                                />
                                <div className="reply-modal__line"></div>
                            </div>
                            <div className="reply-modal__right">
                                <div className="reply-modal__header">
                                    <span className="reply-modal__name">
                                        {blog.author.personal_info.fullname}
                                    </span>
                                    {blog.publishedAt && (
                                        <span className="reply-modal__time">
                                            {getDay(blog.publishedAt)}
                                        </span>
                                    )}
                                </div>
                                <div className="reply-modal__text">
                                    {blog.text_content || blog.title}
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
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey && comment.trim().length > 0) {
                                            e.preventDefault();
                                            handleComment();
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
                                <button className="reply-modal__cancel-btn" onClick={closeModal}>
                                    Cancel
                                </button>
                                <button 
                                    className="reply-modal__post-btn"
                                    onClick={handleComment}
                                    disabled={!comment.trim().length}
                                >
                                    Post
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default CommentField;