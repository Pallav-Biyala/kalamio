import { useContext, useEffect, useState } from "react";
import { BlogContext } from "../pages/blog.page";
import { Link } from "react-router-dom";
import { UserContext } from "../App";
import toast from "react-hot-toast";
import api from "../common/api";
import Icon from "./Icon";


const BlogInteraction = () => {

    let { blog,
        blog: {
            _id, title, blog_id, activity, 
            activity: { total_likes, total_comments }, 
            author: {
                 personal_info: { username: author_username } 
            }
        },
        setBlog, isLikedByUser, setLikedByUser, setCommentsWrapper } = useContext(BlogContext);

    let { userAuth: { username, access_token } } = useContext(UserContext);

    const [isBookmarked, setIsBookmarked] = useState(false);

    useEffect(() => {

        if(access_token){
            // make request to server to get liked information
            api.post("/isliked-by-user", { _id })
            .then(({ data: {result} }) => {
                setLikedByUser(Boolean(result));
            })
            .catch(err => {
            })

            // check bookmark status
            api.post("/is-bookmarked", { blog_id })
            .then(({ data: { bookmarked } }) => {
                setIsBookmarked(bookmarked);
            })
            .catch(err => {
            })
        }

    }, [])

    const handleLike = () => {
        if(access_token){
            // like the blog
            setLikedByUser(preVal => !preVal);

            const newLikes = !isLikedByUser ? total_likes + 1 : total_likes - 1;

            setBlog({ ...blog, activity: { ...activity, total_likes: newLikes } })

            api.post("/like-blog", { _id, isLikedByUser })
            .catch(err => {
            })

        }
        else{
            // user is not logged in and trying to like the blog
            toast.error("Please login to like this blog");
        }
    }

    const handleBookmark = () => {
        if (access_token) {
            const newState = !isBookmarked;
            setIsBookmarked(newState);

            const endpoint = newState ? "/bookmark" : "/remove-bookmark";
            api.post(endpoint, { blog_id })
            .then(() => {
                toast.success(newState ? "Bookmarked" : "Bookmark removed");
            })
            .catch(err => {
                setIsBookmarked(!newState); // revert on error
                toast.error("Failed to update bookmark");
            });
        } else {
            toast.error("Please login to bookmark");
        }
    };

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(location.href);
            toast.success("Link copied to clipboard!");
        } catch {
            toast.error("Failed to copy link");
        }
    }

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
                    <p className="text-base text-dark-grey">{total_likes}</p>


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
                        onClick={handleBookmark}
                        className={"text-dark-grey hover:text-black transition-colors flex items-center gap-1 text-sm font-medium " + (isBookmarked ? "text-black" : "")}
                        aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
                    >
                        <Icon name="bookmark" filled={isBookmarked} className="text-lg" />
                        {isBookmarked ? "Saved" : "Save"}
                    </button>

                    {
                        username == author_username ?
                        <Link to={`/editor/${blog_id}`} className="text-dark-grey hover:text-black transition-colors flex items-center gap-1 text-sm font-medium">
                            <Icon name="edit" className="text-lg" />
                            Edit
                        </Link> : ""
                    }

                    <button 
                        onClick={handleShare}
                        className="text-dark-grey hover:text-black transition-colors flex items-center gap-1 text-sm font-medium"
                    >
                        <Icon name="link" className="text-lg" />
                        Share
                    </button>
                </div>
            </div>

            <hr className="border-border/50 my-2" />
        </>
    )
}

export default BlogInteraction;