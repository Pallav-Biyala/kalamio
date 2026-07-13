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

    // TanStack Query hooks — cached + shared across all instances
    const { data: isLikedByUser } = useLikeStatus(_id);
    const { data: isBookmarked } = useIsSaved(blog_id);
    const likeMutation = useLikeBlog(blog_id);

    const [showSaveModal, setShowSaveModal] = useState(false);

    const handleLike = () => {
        if(access_token){
            likeMutation.mutate({ _id, isLikedByUser });
        }
        else{
            toast.error("Please login to like this blog");
        }
    }

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(location.href);
            toast.success("Link copied to clipboard!");
        } catch {
            toast.error("Failed to copy link");
        }
    }

    // Display like count — use optimistic count from mutation or original
    const displayLikes = likeMutation.isPending
        ? (isLikedByUser ? total_likes - 1 : total_likes + 1)
        : total_likes;

    return (
        <>

            <hr className="border-border/50 my-2" />

            <div className="flex gap-4 sm:gap-6 justify-between flex-wrap py-1">
                <div className="flex gap-2.5 items-center">

                    <button 
                        onClick={handleLike}
                        className={"w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 " + ( isLikedByUser ? "bg-red/10 text-red" : "bg-grey hover:bg-grey/80" )}
                    >
                        <Icon name="favorite" filled={isLikedByUser} className="text-[18px]" />
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
                        className={"text-dark-grey hover:text-black transition-colors flex items-center gap-1 text-sm font-medium select-none " + (isBookmarked ? "text-black" : "")}
                        aria-label="Save"
                    >
                        <Icon name="bookmark" filled={isBookmarked} className="text-lg" />
                        Save
                    </button>

                    {
                        username == author_username ?
                        <Link to={`/editor/${blog_id}`} className="text-dark-grey hover:text-black transition-colors flex items-center gap-1 text-sm font-medium select-none">
                            <Icon name="edit" className="text-lg" />
                            Edit
                        </Link> : ""
                    }

                    <button 
                        onClick={handleShare}
                        className="text-dark-grey hover:text-black transition-colors flex items-center gap-1 text-sm font-medium select-none"
                    >
                        <Icon name="link" className="text-lg" />
                        Share
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