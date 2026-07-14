import { Link, useNavigate } from "react-router-dom";
import { getRelativeTime } from "../common/date";
import Icon from "./Icon";
import Avatar from "./Avatar";
import PostMenu from "./post-menu.component";
import CommentField from "./comment-field.component";
import SaveModal from "./save-modal.component";
import { useContext, useState, useEffect, useRef } from "react";
import { UserContext } from "../App";
import toast from "react-hot-toast";
import api from "../common/api";
import { cdnUrl } from "../common/cdn";
import { useLikeStatus, usePollVoteStatus } from "../hooks/queries";
import { useLikeBlog, useVotePoll } from "../hooks/mutations";
import PollVotersModal from "./poll-voters-modal.component";

const TextPostCard = ({ content, author, onEdit }) => {

    const navigate = useNavigate();
    const { _id, publishedAt, text_content, images, poll: initialPoll, activity: { total_likes, total_comments }, blog_id: id, edited, publication } = content;
    const { fullname, profile_img, username } = author;
    const { userAuth: { access_token, username: loggedInUsername } } = useContext(UserContext);

    const isCreator = loggedInUsername === username;
    const [showVotersModal, setShowVotersModal] = useState(false);

    const [isExpanded, setIsExpanded] = useState(false);
    const [needsTruncation, setNeedsTruncation] = useState(false);
    const [isReplying, setIsReplying] = useState(false);
    const [commentsCount, setCommentsCount] = useState(total_comments);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const textRef = useRef(null);

    // TanStack Query — like status + mutation
    const { data: isLiked = false } = useLikeStatus(_id);
    const likeMutation = useLikeBlog(id);

    const [likesCount, setLikesCount] = useState(total_likes);

    // Sync from server when prop changes (feed refetch / tab switch)
    useEffect(() => {
        setLikesCount(total_likes);
    }, [total_likes]);

    useEffect(() => {
        setCommentsCount(total_comments);
    }, [total_comments]);

    // TanStack Query — poll vote status
    const { data: voteData } = usePollVoteStatus(id);
    const voteMutation = useVotePoll();
    const [poll, setPoll] = useState(initialPoll);
    const hasVoted = voteData?.hasVoted || false;
    const selectedOption = voteData?.option_index ?? null;

    useEffect(() => {
        if (textRef.current) {
            if (textRef.current.scrollHeight > textRef.current.clientHeight) {
                setNeedsTruncation(true);
            }
        }
    }, [text_content, isExpanded]);

    const formatCount = (n) => {
        if (n >= 1000) return (n / 1000).toFixed(1) + "K";
        return n;
    };

    const handleLike = (e) => {
        e.preventDefault();
        if (access_token) {
            setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
            likeMutation.mutate({ _id, isLikedByUser: isLiked });
        } else {
            toast.error("Please login to like this post");
        }
    };

    const handleVote = (optionIndex) => {
        if (hasVoted || !access_token) {
            if (!access_token) toast.error("Please login to vote");
            return;
        }

        // Optimistic update for poll UI
        setPoll(prev => {
            const updated = { ...prev };
            updated.options = prev.options.map((opt, i) => ({
                ...opt,
                votes: i === optionIndex ? opt.votes + 1 : opt.votes
            }));
            updated.total_votes = (prev.total_votes || 0) + 1;
            return updated;
        });

        voteMutation.mutate(
            { blogId: id, optionIndex },
            {
                onSuccess: (data) => {
                    if (data?.poll) setPoll(data.poll);
                },
                onError: () => {
                    toast.error("Vote failed");
                    setPoll(initialPoll);
                },
            }
        );
    };

    // Render text with line breaks preserved
    const renderText = (text) => {
        if (!text) return null;
        
        const parts = text.split(/(@[\w](?:[\w.]*[\w])?)/g);
        
        return parts.map((part, i) => {
            if (part.startsWith('@') && part.length > 1) {
                const username = part.slice(1);
                return (
                    <Link key={i} to={`/user/${username}`} className="mention-link">
                        {part}
                    </Link>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div className="feed-card">
            {/* Header */}
            <div className="feed-card__header">
                <Link to={`/user/${username}`} className="feed-card__author">
                    <Avatar src={profile_img} alt={fullname} size={40} className="feed-card__avatar" />
                    <div className="feed-card__author-info">
                        <span className="feed-card__author-name">{fullname}</span>
                        <span className="feed-card__meta">
                            {publication && (
                                <span className="opacity-80">
                                    in{' '}
                                    <span className="feed-card__pub-label" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/publication/${publication.slug}`); }} role="link" tabIndex={0}>
                                        {publication.title}
                                    </span>
                                </span>
                            )}
                            {publication && <span className="feed-card__meta-dot">·</span>}
                            {getRelativeTime(publishedAt)}
                            {edited && <span className="feed-card__edited">· edited</span>}
                        </span>
                    </div>
                </Link>
                <PostMenu blogId={id} authorUsername={username} postType="text_post" onEdit={onEdit} onSaveToCollection={() => setShowSaveModal(true)} />
            </div>

            {/* Text Content */}
            <div className="feed-card__text-post-wrapper">
                <div 
                    ref={textRef}
                    className={`feed-card__text-post-content cursor-pointer ${!isExpanded ? 'feed-card__text-post-content--clamped' : ''}`}
                    onClick={(e) => {
                        if (e.target.closest('a')) return;
                        navigate(`/blog/${id}`);
                    }}
                >
                    {renderText(text_content)}
                </div>
                {needsTruncation && !isExpanded && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(true);
                        }} 
                        className="text-dark-grey font-medium text-[15px] hover:text-black mt-1"
                    >
                        See more
                    </button>
                )}
            </div>

            {/* Images */}
            {images && images.length > 0 && (
                <div className={`feed-card__text-post-images feed-card__text-post-images--${Math.min(images.length, 4)}`}>
                    {images.map((url, i) => (
                        <img key={i} src={cdnUrl(url)} alt={`Image ${i + 1}`} className="feed-card__text-post-image" />
                    ))}
                </div>
            )}

            {/* Poll */}
            {poll && poll.options && poll.options.length > 0 && (
                <div className="feed-card__text-post-poll">
                    {poll.question && (
                        <div className="feed-card__text-post-poll-header">
                            <Icon name="bar_chart" className="feed-card__text-post-poll-icon" />
                            <span className="feed-card__text-post-poll-question">{poll.question}</span>
                        </div>
                    )}

                    <div className="feed-card__text-post-poll-options">
                        {poll.options.map((opt, i) => {
                            const totalVotes = poll.total_votes || 0;
                            const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                            const isSelected = selectedOption === i;

                            return (
                                <div
                                    key={i}
                                    className={`feed-card__text-post-poll-option ${hasVoted ? 'feed-card__text-post-poll-option--voted' : ''} ${isSelected ? 'feed-card__text-post-poll-option--selected' : ''}`}
                                    onClick={() => !hasVoted && handleVote(i)}
                                >
                                    {hasVoted && (
                                        <div
                                            className="feed-card__text-post-poll-bar"
                                            style={{ width: `${percent}%` }}
                                        />
                                    )}
                                    <div className="feed-card__text-post-poll-label">
                                        <span className="feed-card__text-post-poll-text">
                                            {!hasVoted && (
                                                <span className="feed-card__text-post-poll-radio" />
                                            )}
                                            {hasVoted && isSelected && (
                                                <Icon name="check_circle" className="feed-card__text-post-poll-check" />
                                            )}
                                            {opt.text}
                                        </span>
                                        {hasVoted && (
                                            <span className="feed-card__text-post-poll-percent">{percent}%</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="feed-card__text-post-poll-footer">
                        <div className="flex items-center gap-1">
                            <Icon name="people_outline" className="text-sm" />
                            <span>{poll.total_votes || 0} vote{(poll.total_votes || 0) !== 1 ? 's' : ''}</span>
                        </div>
                        {isCreator && (poll.total_votes || 0) > 0 && (
                            <button
                                className="poll-voters-btn"
                                onClick={(e) => { e.stopPropagation(); setShowVotersModal(true); }}
                            >
                                <Icon name="visibility" className="text-sm" />
                                See voters
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Poll Voters Modal */}
            {showVotersModal && (
                <PollVotersModal
                    blogId={id}
                    poll={poll}
                    isOpen={showVotersModal}
                    onClose={() => setShowVotersModal(false)}
                />
            )}

            {/* Actions */}
            <div className="feed-card__actions">
                <button onClick={handleLike} className={`feed-card__action${isLiked ? " feed-card__action--like" : ""}`}>
                    <Icon name={isLiked ? "favorite" : "favorite_border"} />
                    <span>{likesCount > 0 ? formatCount(likesCount) : "0"}</span>
                </button>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (!access_token) return toast.error("Please login to comment");
                        setIsReplying(true);
                    }} 
                    className="feed-card__action"
                >
                    <Icon name="chat_bubble_outline" />
                    <span>{commentsCount > 0 ? commentsCount : "0"}</span>
                </button>
                <span className="feed-card__action feed-card__action--share">
                    <Icon name="ios_share" />
                    <span className="hidden sm:inline">Share</span>
                </span>
            </div>

            {isReplying && (
                <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <CommentField 
                        action="comment" 
                        defaultOpen={true} 
                        onClose={() => setIsReplying(false)}
                        customBlogData={content}
                        onCommentPosted={() => setCommentsCount(prev => prev + 1)}
                    />
                </div>
            )}
            {/* Save Modal */}
            {showSaveModal && (
                <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <SaveModal
                        blogId={id}
                        isOpen={showSaveModal}
                        onClose={() => setShowSaveModal(false)}
                    />
                </div>
            )}
        </div>
    );
};

export default TextPostCard;
