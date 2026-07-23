import { Link, useNavigate } from "react-router-dom";
import { getRelativeTime } from "../common/date";
import Icon from "./Icon";
import Avatar from "./Avatar";
import { cdnUrl } from "../common/cdn";
import PostMenu from "./post-menu.component";
import CommentField from "./comment-field.component";
import SaveModal from "./save-modal.component";
import { useContext, useState, useEffect } from "react";
import { UserContext } from "../App";
import toast from "react-hot-toast";
import { useLikeStatus } from "../hooks/queries";
import { useLikeBlog } from "../hooks/mutations";

const BlogPostCard = ({ content, author }) => {

   const navigate = useNavigate();
   let { _id, publishedAt, tags, title, des, banner, activity: { total_likes, total_comments }, blog_id: id, readTime, publication, edited, type } = content;

   let { fullname, profile_img, username } = author;

   let { userAuth: { access_token } } = useContext(UserContext);

   // TanStack Query — like status + mutation
   const { data: isLiked = false } = useLikeStatus(_id);
   const likeMutation = useLikeBlog(id);

   const [showCommentModal, setShowCommentModal] = useState(false);
   const [showSaveModal, setShowSaveModal] = useState(false);
   const [commentsCount, setCommentsCount] = useState(total_comments);

   // The like count is read straight from `total_likes` (the query-cache-backed prop), NOT mirrored
   // into local state. useLikeBlog already patches that cache optimistically and then adopts the
   // server's authoritative count, so the prop is the single source of truth. A local `likesCount`
   // useState + a sync effect + an optimistic setter (what this used to be) is a THIRD writer that
   // races the other two: with instant localhost responses the three converge, but under real
   // network latency (dev/prod) they land out of order and the displayed count sticks at the wrong
   // value — which is why the article (reads the prop directly) worked while the feed card didn't.

   useEffect(() => {
       setCommentsCount(total_comments);
   }, [total_comments]);

   const displayReadTime = readTime || 1;

   const formatCount = (n) => {
       if (n >= 1000) return (n / 1000).toFixed(1) + "K";
       return n;
   };

   const handleShare = async (e) => {
       e.preventDefault();
       e.stopPropagation();
       // Same URL shape and toast copy as PostMenu's "Copy link" so sharing is consistent app-wide.
       const url = `${window.location.origin}/blog/${id}`;
       if(navigator.share){
           try {
               await navigator.share({ title, url });
               return;
           } catch (err) {
               // Dismissing the native share sheet rejects with AbortError — that's not a failure,
               // so stay silent rather than falling through to the clipboard path.
               if (err?.name === "AbortError") return;
           }
       }
       navigator.clipboard.writeText(url)
           .then(() => toast.success("Link copied"))
           .catch(() => toast.error("Failed to copy"));
   }

   const handleLike = (e) => {
       e.preventDefault();
       if(access_token){
           // toggle() reads the freshest like-status from the cache (not the stale `isLiked`
           // closure) and does NOT drop rapid taps — so a like→unlike double-tap reliably reaches
           // the server. useLikeBlog.onMutate patches total_likes in the cache, which flows back
           // through the `content` prop and re-renders this card; no local optimistic count here.
           likeMutation.toggle(_id);
       }
       else{
           toast.error("Please login to like this blog");
       }
   }
    
    return(
        <div className="feed-card">

            {/* ── Author Row ── */}
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
                            {displayReadTime} min read · {getRelativeTime(publishedAt)}
                            {edited && <span className="feed-card__edited">· edited</span>}
                        </span>
                    </div>
                </Link>
                <PostMenu blogId={id} authorId={content.author?._id} authorUsername={username} postType={type || 'blog'} onSaveToCollection={() => setShowSaveModal(true)} />
            </div>

            {/* ── Content: Title + Description + Tags (left) | Thumbnail (right) ── */}
            <Link to={`/blog/${id}`} className="feed-card__body">
                <div className="feed-card__text">
                    <div className="feed-card__title">{title}</div>
                    <p className="feed-card__description">{des}</p>

                    {/* Tags inside text column */}
                    {tags && tags.length > 0 && (
                        <div className="feed-card__tags" onClick={(e) => e.preventDefault()}>
                            {tags.slice(0, 3).map((tag, i) => (
                                <span key={i} className="feed-card__tag" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/search/${encodeURIComponent(tag)}`); }} role="link" tabIndex={0}>#{tag}</span>
                            ))}
                        </div>
                    )}
                </div>

                {banner && (
                    <div className="feed-card__thumbnail">
                        <img src={cdnUrl(banner)} alt={title}/>
                    </div>
                )}
            </Link>

            {/* ── Action Bar ── */}
            <div className="feed-card__actions">
                <button onClick={handleLike} className={`feed-card__action${isLiked ? " feed-card__action--like" : ""}`}>
                    <Icon name={isLiked ? "favorite" : "favorite_border"} />
                    <span>{total_likes > 0 ? formatCount(total_likes) : "0"}</span>
                </button>
                <button 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!access_token) return toast.error("Please login to comment");
                        setShowCommentModal(true);
                    }}
                    className="feed-card__action"
                >
                    <Icon name="chat_bubble_outline" />
                    <span>{commentsCount > 0 ? commentsCount : "0"}</span>
                </button>
                <button
                    type="button"
                    onClick={handleShare}
                    aria-label="Share post"
                    className="feed-card__action feed-card__action--share"
                >
                    <Icon name="ios_share" />
                    <span className="hidden sm:inline">Share</span>
                </button>
            </div>

            {/* Comment Modal */}
            {showCommentModal && (
                <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <CommentField 
                        action="comment" 
                        defaultOpen={true} 
                        onClose={() => setShowCommentModal(false)}
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
    )
}

export default BlogPostCard;