import { useContext } from "react";
import { BlogContext } from "../pages/blog.page";
import CommentField from "./comment-field.component";
import api from "../common/api";
import NoDataMessage from "./nodata.component";
import AnimationWrapper from "../common/page-animation";
import CommentCard from "./comment-card.component";

export const fetchComments = async ({ skip=0, blog_id, setParentCommentCountFun, comment_array = null }) => {

    let res;

    await api.post("/get-blog-comments", { blog_id, skip })
    .then(({ data }) => {

        data.map(comment => {
            comment.childrenLevel = 0;
        })

        setParentCommentCountFun(preVal => preVal + data.length)

        if(comment_array == null){
            res = { results: data }
        } 
        else{
            res = { results: [ ...comment_array, ...data ] }
        }

    })

    return res;

}

const CommentsContainer = () => {

    let { blog, blog: { _id, title, type, comments: { results: commentsArr }, activity: { total_parent_comments } }, commentsWrapper, setCommentsWrapper, totalParentCommentsLoaded, setTotalParentCommentsLoaded, setBlog } = useContext(BlogContext);

    const isTextPost = type === 'text_post';

    const loadMoreComments = async () => {

        let newCommentsArr = await fetchComments({ skip: totalParentCommentsLoaded, blog_id: _id, setParentCommentCountFun: setTotalParentCommentsLoaded, comment_array: commentsArr })

        setBlog({ ...blog, comments: newCommentsArr })

    }

    return(
        <div id="comments-section" className="comments-section">
            <div className="comments-section__divider"></div>

            <div className="comments-section__header">
                <span className="comments-section__count">
                    {total_parent_comments > 0 
                        ? `${total_parent_comments} ${total_parent_comments === 1 ? 'Comment' : 'Comments'}` 
                        : 'Comments'
                    }
                </span>
            </div>

            <CommentField action="Comment" />

            <div className="comments-section__list">
                {
                    commentsArr && commentsArr.length ? 
                    commentsArr.map((comment, i) => {
                        return <AnimationWrapper key={comment._id || i}>
                            <CommentCard index={i} commentData={comment} isTextPost={isTextPost} />
                        </AnimationWrapper>
                    }) : <NoDataMessage message="No Comments" />
                }
            </div>

            {
                total_parent_comments > totalParentCommentsLoaded ? 
                <button 
                    onClick={loadMoreComments}
                    className="comments-section__load-more"
                >
                    Load More Comments
                </button>
                : ""
            }
        </div>
    )
}

export default CommentsContainer;