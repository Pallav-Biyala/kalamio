import { useContext, useState } from "react";
import { UserContext } from "../App";
import toast from "react-hot-toast";
import api from "../common/api";
import { BlogContext } from "../pages/blog.page";
import Avatar from "./Avatar";

const CommentField = ({ action, index = undefined, replyingTo = undefined, setReplying }) => {

    let { blog, blog: { _id, author: { _id: blog_author }, comments, comments: { results: commentsArr }, activity, activity: { total_comments, total_parent_comments } }, setBlog, setTotalParentCommentsLoaded } = useContext(BlogContext);

    let { userAuth: { access_token, username, profile_img, fullname } } = useContext(UserContext);

    const [ comment, setComment ] = useState("");

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

            data.commented_by = { personal_info: { username, profile_img, fullname } }

            let newCommentArr;

            if(replyingTo){
                
                commentsArr[index].children.push(data._id);

                data.childrenLevel = commentsArr[index].childrenLevel + 1;
                data.parentIndex = index;

                commentsArr[index].isReplyLoaded = true;

                commentsArr.splice(index + 1, 0, data);

                newCommentArr = commentsArr;

                setReplying(false);

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

    return(
        <div className="flex gap-4 items-start mb-8">
            <Avatar src={profile_img} alt={username} size={36} />
            <div className="flex-1 border border-border rounded-xl p-3 px-4 focus-within:border-dark-grey transition-colors">
                <textarea 
                    id={action === 'reply' ? undefined : "comment-textarea"}
                    value={comment} 
                    onChange={(e) => {
                        setComment(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    placeholder={action === 'reply' ? "Leave a reply..." : "Leave a comment..."}
                    className="w-full bg-transparent outline-none text-[15px] resize-none min-h-[24px]"
                    style={{ overflow: 'hidden' }}
                />

                {comment.length > 0 && (
                    <div className="flex justify-end mt-2">
                        <button 
                            onClick={handleComment}
                            className="bg-black text-white rounded-full px-5 py-1.5 text-sm font-medium hover:bg-black/80 transition-colors"
                        >
                            {action === 'reply' ? 'Reply' : 'Post'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default CommentField;