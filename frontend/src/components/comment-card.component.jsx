import { useContext, useState } from "react";
import { getDay } from "../common/date";
import { UserContext } from "../App";
import toast from "react-hot-toast";
import CommentField from "./comment-field.component";
import { BlogContext } from "../pages/blog.page";
import api from "../common/api";
import Icon from "./Icon";
import Avatar from "./Avatar";
import { Link } from "react-router-dom";

const CommentCard = ({ index, leftVal, commentData }) => {

    let { commented_by: { personal_info: { profile_img, fullname, username: commented_by_username } }, commentedAt, comment, images, poll, _id, children } = commentData

    let { blog, blog: { comments, activity, activity: { total_parent_comments }, comments: { results: commentsArr }, author: { personal_info: { username: blog_author } } }, setBlog, setTotalParentCommentsLoaded } = useContext(BlogContext)

    let { userAuth: { access_token, username } } = useContext(UserContext)
    const [ isReplying, setReplying ] = useState(false);

    const getParentIndex = () => {
        let startingPoint = index - 1;

        try{
            while(commentsArr[startingPoint].childrenLevel >= commentData.childrenLevel){
                startingPoint--;
            }
        } catch{
            startingPoint = undefined;
        }
        return startingPoint;
    }

    const removeCommentsCards = (startingPoint, isDelete = false) => {

        if(commentsArr[startingPoint]){

            while(commentsArr[startingPoint].childrenLevel > commentData.childrenLevel){
                commentsArr.splice(startingPoint, 1)

                if(!commentsArr[startingPoint]){
                    break;
                }
            }

        }

        if(isDelete){

            let parentIndex = getParentIndex();

            if(parentIndex != undefined){
                commentsArr[parentIndex].children = commentsArr[parentIndex].children.filter(child => child != _id)

                if(!commentsArr[parentIndex].children.length){
                    commentsArr[parentIndex].isReplyLoaded = false;
                }
            }

            commentsArr.splice(index, 1);
        }

        if(commentData.childrenLevel == 0 && isDelete){
            setTotalParentCommentsLoaded(preVal => preVal - 1)
        }
        

        setBlog({ ...blog, comments: { results: commentsArr }, activity: { ...activity, total_parent_comments: total_parent_comments - (commentData.childrenLevel == 0 && isDelete ? 1 : 0) } })

    }

    const loadReplies = ({ skip = 0, currentIndex = index }) => {

        if(commentsArr[currentIndex].children.length){
            
            hideReplies();

            api.post("/get-replies", { _id: commentsArr[currentIndex]._id, skip })
            .then(({ data: { replies } }) => {

                commentsArr[currentIndex].isReplyLoaded = true;

                for(let i=0; i<replies.length; i++){

                    replies[i].childrenLevel = commentsArr[currentIndex].childrenLevel + 1;

                    commentsArr.splice(currentIndex + 1 + i + skip, 0, replies[i])

                }

                setBlog({ ...blog, comments: { ...comments, results: commentsArr } })

            })
            .catch(err => {
            })

        }

    }

    const deletComment = (e) => {

        e.target.setAttribute("disabled", true);

        api.post("/delete-comment", { _id })
        .then(() => {
            e.target.removeAttribute("disabled");
            removeCommentsCards(index + 1, true);
        })
        .catch(err => {
        })

    }

    const hideReplies = () => {

        commentData.isReplyLoaded = false;

        removeCommentsCards(index + 1);
        
    }

    const handleReplyClick = () => {

        if(!access_token){
            return toast.error("login first to leave a reply")
        }

        setReplying(preVal => !preVal);

    }

    const LoadMoreRepliesBtn = () => {

        let parentIndex = getParentIndex();

        let button = <button 
                        onClick={() => loadReplies({ skip: index - parentIndex, currentIndex: parentIndex })}
                        className="text-dark-grey p-2 px-3 hover:bg-grey/30 rounded-md flex items-center gap-2"
                    >Load More Replies</button>

        if(commentsArr[index + 1]){
            if(commentsArr[index + 1].childrenLevel < commentsArr[index].childrenLevel){
                if((index - parentIndex) < commentsArr[parentIndex].children.length){

                    return button;
                
                }
            }
        } else{
            if(parentIndex){
                if((index - parentIndex) < commentsArr[parentIndex].children.length){

                    return button;
                
                }
            }
        }

    }

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
        <div className="w-full" style={{ paddingLeft: `min(${leftVal * 10}px, 15vw)` }}>
            <div className="my-5 flex gap-4">
                <Avatar src={profile_img} alt={commented_by_username} size={36} />
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-[15px]">{fullname}</p>
                        <p className="text-dark-grey text-sm">{getDay(commentedAt)}</p>
                    </div>

                    <p className="font-inter text-[15px] mb-3 whitespace-pre-wrap">{renderText(comment)}</p>

                    {/* Images */}
                    {images && images.length > 0 && (
                        <div className={`feed-card__text-post-images feed-card__text-post-images--${Math.min(images.length, 4)} mb-4`}>
                            {images.map((url, i) => (
                                <img key={i} src={url} alt={`Image ${i + 1}`} className="feed-card__text-post-image" />
                            ))}
                        </div>
                    )}

                    {/* Poll */}
                    {poll && poll.options && poll.options.length > 0 && (
                        <div className="feed-card__text-post-poll mb-4">
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
                                    return (
                                        <div key={i} className="feed-card__text-post-poll-option">
                                            <div className="feed-card__text-post-poll-label">
                                                <span className="feed-card__text-post-poll-text">{opt.text}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="feed-card__text-post-poll-footer">
                                <Icon name="people_outline" className="text-sm" />
                                <span>{poll.total_votes || 0} vote{(poll.total_votes || 0) !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4 items-center mt-2">
                        {/* Fake like button for visual similarity */}
                        <button className="flex items-center gap-1.5 text-dark-grey hover:text-black transition-colors">
                            <Icon name="favorite_border" className="text-lg" />
                            <span className="text-sm">0</span>
                        </button>

                        <button 
                            className="flex items-center gap-1.5 text-dark-grey hover:text-black transition-colors"
                            onClick={handleReplyClick}
                        >
                            <Icon name="chat_bubble_outline" className="text-lg" />
                            <span className="text-sm">Reply</span>
                        </button>

                        {/* Expand/Collapse Replies */}
                        {children.length > 0 && (
                            commentData.isReplyLoaded ? 
                            <button 
                                onClick={hideReplies}
                                className="text-dark-grey hover:text-black flex items-center gap-1.5 text-sm ml-2 transition-colors"
                            >
                                Hide Replies
                            </button> : 
                            <button 
                                onClick={loadReplies}
                                className="text-dark-grey hover:text-black flex items-center gap-1.5 text-sm ml-2 transition-colors"
                            >
                                {children.length} Reply
                            </button>
                        )}

                        {
                            username == commented_by_username || username == blog_author ? 
                            <button 
                                onClick={deletComment}
                                className="text-dark-grey hover:text-red transition-colors ml-auto flex items-center"
                            >
                                <Icon name="delete" className="text-lg pointer-events-none" />
                            </button> : ""
                        }
                    </div>

                    {
                        isReplying ? 
                        <div className="mt-5">
                            <CommentField action="reply" index={index} replyingTo={_id} setReplying={setReplying} />
                        </div> : ""
                    }
                </div>
            </div>

            <LoadMoreRepliesBtn />
        </div>
    )
}

export default CommentCard;