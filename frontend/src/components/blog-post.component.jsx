import { Link, useNavigate } from "react-router-dom";
import { getRelativeTime } from "../common/date";
import Icon from "./Icon";
import Avatar from "./Avatar";
import PostMenu from "./post-menu.component";
import CommentField from "./comment-field.component";
import { useContext, useState, useEffect } from "react";
import { UserContext } from "../App";
import toast from "react-hot-toast";
import api from "../common/api";

const BlogPostCard = ({ content, author }) => {

   const navigate = useNavigate();
   let { _id, publishedAt, tags, title, des, banner, activity: { total_likes, total_comments }, blog_id: id, readTime, publication, edited, type } = content;

   let { fullname, profile_img, username } = author;

   let { userAuth: { access_token } } = useContext(UserContext);

   const [isLiked, setIsLiked] = useState(false);
   const [likesCount, setLikesCount] = useState(total_likes);
   const [commentsCount, setCommentsCount] = useState(total_comments);
   const [showCommentModal, setShowCommentModal] = useState(false);

   useEffect(() => {
       setLikesCount(total_likes);
   }, [total_likes]);

   useEffect(() => {
       setCommentsCount(total_comments);
   }, [total_comments]);

   useEffect(() => {
        if(access_token){
            api.post("/isliked-by-user", { _id })
            .then(({ data: {result} }) => {
                setIsLiked(Boolean(result));
            })
            .catch(err => {
            })
        }
   }, [access_token, _id])

   const displayReadTime = readTime || 1;

   const formatCount = (n) => {
       if (n >= 1000) return (n / 1000).toFixed(1) + "K";
       return n;
   };

   const handleLike = (e) => {
       e.preventDefault();
       if(access_token){
           setIsLiked(preVal => !preVal);
           setLikesCount(preVal => !isLiked ? preVal + 1 : preVal - 1);

           api.post("/like-blog", { _id, isLikedByUser: isLiked })
           .catch(err => {
               // silently fail or revert
           })
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
                <PostMenu blogId={id} authorUsername={username} postType={type || 'blog'} />
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
                                <span key={i} className="feed-card__tag" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/search/${tag}`); }} role="link" tabIndex={0}>#{tag}</span>
                            ))}
                        </div>
                    )}
                </div>

                {banner && (
                    <div className="feed-card__thumbnail">
                        <img src={banner} alt={title}/>
                    </div>
                )}
            </Link>

            {/* ── Action Bar ── */}
            <div className="feed-card__actions">
                <button onClick={handleLike} className={`feed-card__action${isLiked ? " feed-card__action--like" : ""}`}>
                    <Icon name={isLiked ? "favorite" : "favorite_border"} />
                    <span>{likesCount > 0 ? formatCount(likesCount) : "0"}</span>
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
                <span className="feed-card__action">
                    <Icon name="bookmark_border" />
                    <span className="hidden sm:inline">Save</span>
                </span>
                <span className="feed-card__action feed-card__action--share">
                    <Icon name="ios_share" />
                    <span className="hidden sm:inline">Share</span>
                </span>
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
        </div>
    )
}

export default BlogPostCard;