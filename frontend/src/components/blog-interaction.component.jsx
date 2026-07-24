import { useContext, useState } from "react";
import { BlogContext } from "../pages/blog.page";
import { Link } from "react-router-dom";
import { UserContext } from "../App";
import toast from "react-hot-toast";
import Icon from "./Icon";
import SaveModal from "./save-modal.component";
import { useLikeStatus, useIsSaved } from "../hooks/queries";
import { useLikeBlog } from "../hooks/mutations";


const BlogInteraction = () => {

    let { blog,
        blog: {
            _id, title, blog_id, activity, 
            activity: { total_likes, total_comments }, 
            author: {
                 personal_info: { username: author_username } 
            }
        },
        setCommentsWrapper } = useContext(BlogContext);

    let { userAuth: { username, access_token } } = useContext(UserContext);

    // TanStack Query hooks — cached + shared across all instances.
    // Default to false: while this query is loading `data` is undefined, and sending that put
    // `isLikedByUser: undefined` on the wire — JSON drops the key, the request fails validation,
    // and the mutation's onError rolled the optimistic like straight back, so liking a post right
    // after a refresh looked like the like was being removed.
    const { data: isLikedByUser = false } = useLikeStatus(_id);
    const { data: isBookmarked } = useIsSaved(blog_id);
    const likeMutation = useLikeBlog(blog_id);

    const [showSaveModal, setShowSaveModal] = useState(false);

    const handleLike = () => {
        if(access_token){
            // toggle() reads the freshest like-status from the cache (not the stale `isLikedByUser`
            // closure) and never drops a rapid tap, so a like→unlike double-tap reliably reaches the
            // server. Same robust path the feed cards use.
            likeMutation.toggle(_id);
        }
        else{
            toast.error("Please login to like this blog");
        }
    }

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(location.href);
            toast.success("Link copied");
        } catch {
            toast.error("Failed to copy link");
        }
    }

    // useLikeBlog.onMutate already optimistically adjusts total_likes in the query cache (synced into
    // context), so render it directly — adjusting again here would double-count (show the stale value).
    const displayLikes = total_likes;

    return (
        <>

            <hr className="border-border/50 my-2" />

            <div className="flex gap-4 sm:gap-6 justify-between flex-wrap py-1">
                <div className="flex gap-2.5 items-center">

                    <button
                        onClick={handleLike}
                        aria-label="Like"
                        aria-pressed={isLikedByUser}
                        className={"w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 " + ( isLikedByUser ? "bg-red/10 text-red" : "bg-grey hover:bg-grey/80" )}
                    >
                        <Icon name={isLikedByUser ? "favorite" : "favorite_border"} className="text-[18px]" />
                    </button>
                    <p className="text-base text-dark-grey">{displayLikes}</p>


                    <button 
                        onClick={() => {
                            const commentBox = document.getElementById("comment-textarea");
                            if (commentBox) {
                                commentBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                setTimeout(() => commentBox.click(), 400);
                            }
                        }}
                        aria-label="Comment"
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-grey hover:bg-grey/80 transition-colors ml-2"
                    >
                        <Icon name="chat_bubble" className="text-[18px]" />
                    </button>
                    <p className="text-base text-dark-grey">{total_comments}</p>

                </div>

                <div className="flex gap-4 sm:gap-6 items-center">

                    <button
                        onClick={() => {
                            if (!access_token) return toast.error("Please login to save");
                            setShowSaveModal(true);
                        }}
                        className={"w-8 h-8 rounded-full flex items-center justify-center transition-colors " + (isBookmarked ? "bg-grey text-black" : "bg-grey hover:bg-grey/80")}
                        aria-label="Save"
                    >
                        <Icon name="bookmark" filled={isBookmarked} className="text-[18px]" />
                    </button>

                    {
                        username == author_username ?
                        <Link to={`/editor/${blog_id}`} className="w-8 h-8 rounded-full flex items-center justify-center bg-grey hover:bg-grey/80 transition-colors" aria-label="Edit">
                            <Icon name="edit" className="text-[18px]" />
                        </Link> : ""
                    }

                    <button
                        onClick={handleShare}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-grey hover:bg-grey/80 transition-colors"
                        aria-label="Share"
                    >
                        <Icon name="link" className="text-[18px]" />
                    </button>
                </div>
            </div>

            <hr className="border-border/50 my-2" />

            {showSaveModal && (
                <SaveModal
                    blogId={blog_id}
                    isOpen={showSaveModal}
                    onClose={() => setShowSaveModal(false)}
                />
            )}
        </>
    )
}

export default BlogInteraction;