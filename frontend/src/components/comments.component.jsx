import { useContext } from "react";
import { BlogContext } from "../pages/blog.page";
import CommentField from "./comment-field.component";
import api from "../common/api";
import Icon from "./Icon";
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

    let { blog, blog: { _id, title, comments: { results: commentsArr }, activity: { total_parent_comments } }, commentsWrapper, setCommentsWrapper, totalParentCommentsLoaded, setTotalParentCommentsLoaded, setBlog } = useContext(BlogContext);

    const loadMoreComments = async () => {

        let newCommentsArr = await fetchComments({ skip: totalParentCommentsLoaded, blog_id: _id, setParentCommentCountFun: setTotalParentCommentsLoaded, comment_array: commentsArr })

        setBlog({ ...blog, comments: newCommentsArr })

    }

    return(
        <div id="comments-section" className="w-full mt-8">
            <hr className="border-border my-8 w-full" />

            <h1 className="text-xl font-semibold mb-6">Comments</h1>

            <CommentField action="Comment" />

                {
                    commentsArr && commentsArr.length ? 
                    commentsArr.map((comment, i) => {
                        return <AnimationWrapper key={i}>
                            <CommentCard index={i} leftVal={comment.childrenLevel*4} commentData={comment} />
                        </AnimationWrapper>
                    }) : <NoDataMessage message="No Comments" />
                }

                {
                    total_parent_comments > totalParentCommentsLoaded ? 
                    <button 
                        onClick={loadMoreComments}
                        className="text-dark-grey font-medium p-2 px-4 hover:text-black rounded-full flex items-center gap-2 mt-4 text-sm border border-border hover:border-dark-grey transition-all"
                    >
                        Load More
                    </button>
                    : ""
                }

        </div>
    )
}

export default CommentsContainer;