import { useContext, useState } from "react";
import toast from "react-hot-toast";
import { UserContext } from "../App";
import api from "../common/api";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../common/queryKeys";

const NotificationCommentField = ({ _id, blog_author, index=undefined, replyingTo=undefined, setReplying, notification_id }) => {

    let [ comment, setComment ] = useState('');

    let { _id: user_id } = blog_author;
    let { userAuth: { access_token }} = useContext(UserContext);
    const queryClient = useQueryClient();

    const handleComment = () => {

        if(!comment.length){
            return toast.error("Write something to leave a comment")
        }

        api.post("/add-comment", {
            _id, blog_author: user_id, comment, replying_to: replyingTo, notification_id
        })
        .then(({ data }) => {
            
            setReplying(false);
            // Invalidate notifications so the reply shows up
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });

        })
        .catch(err => {
        })
    }

    return(
        <>

            <textarea 
                value={comment} 
                onChange={(e) => setComment(e.target.value)}
                placeholder="Leave a reply..." 
                className="input-box pl-5 placeholder:text-dark-grey resize-none h-[150px] overflow-auto"
            > </textarea>

            <button 
                onClick={handleComment}
                className="btn-dark mt-5 px-10"
            >Reply</button>
        </>
    )
}

export default NotificationCommentField;