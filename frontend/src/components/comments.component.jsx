import { useContext, useState } from "react";
import { BlogContext } from "../pages/blog.page";
import CommentField from "./comment-field.component";
import api from "../common/api";
import NoDataMessage from "./nodata.component";
import AnimationWrapper from "../common/page-animation";
import CommentCard from "./comment-card.component";

/**
 * Fetch comments for a blog. Kept as a standalone export for backward
 * compatibility with blog.page.jsx (initial comment load on mount).
 */
export const fetchComments = async ({ skip=0, blog_id, setParentCommentCountFun, comment_array = null }) => {

    let res;

    await api.post("/get-blog-comments", { blog_id, skip })
    .then(({ data }) => {

        // Server returns { comments, total_comments, total_parent_comments } with the counts freshly
        // synced to the true document counts. Tolerate a bare array too (older server) so a version
        // skew doesn't blank the list.
        const list = Array.isArray(data) ? data : (data.comments || []);

        list.forEach(comment => {
            comment.childrenLevel = 0;
        })

        if (setParentCommentCountFun) setParentCommentCountFun(preVal => preVal + list.length)

        let results;
        if(comment_array == null){
            results = list;
        }
        else{
            // Dedupe by _id so a skip/refetch overlap can't insert the same comment twice.
            const seen = new Set(comment_array.map(c => c._id));
            results = [ ...comment_array, ...list.filter(c => !seen.has(c._id)) ];
        }

        res = {
            results,
            total_comments: Array.isArray(data) ? undefined : data.total_comments,
            total_parent_comments: Array.isArray(data) ? undefined : data.total_parent_comments,
        };

    })

    return res;

}

const CommentsContainer = () => {

    let { blog, commentsWrapper, setCommentsWrapper, setBlog } = useContext(BlogContext);

    // total_comments counts replies too (matching the interaction-bar icon and every feed card);
    // total_parent_comments counts only top-level threads and drives the "Load More" pagination.
    const { _id, title, type, comments, activity: { total_comments, total_parent_comments } = {} } = blog || {};
    const commentsArr = comments?.results || [];

    const isTextPost = type === 'text_post';

    const [loadingMore, setLoadingMore] = useState(false);

    // How many top-level comments are loaded — derived from the list itself, NOT a running counter.
    // The old counter was incremented on every fetch (including each tab-focus refetch, which reloads
    // page 1), so it drifted above the real count and the button flickered on/off. The array length is
    // always in sync with what's actually rendered, so the button can't disagree with the list.
    const loadedCount = commentsArr.length;
    const hasMoreComments = (total_parent_comments || 0) > loadedCount;

    const loadMoreComments = async () => {
        if (loadingMore || !_id) return;
        setLoadingMore(true);
        try {
            const res = await fetchComments({ skip: loadedCount, blog_id: _id, comment_array: commentsArr });
            if (setBlog && res) {
                setBlog(prev => ({
                    ...prev,
                    comments: { results: res.results },
                    activity: {
                        ...prev.activity,
                        ...(res.total_comments != null ? { total_comments: res.total_comments } : {}),
                        ...(res.total_parent_comments != null ? { total_parent_comments: res.total_parent_comments } : {}),
                    },
                }));
            }
        } catch {
            // Leave the button in place so the user can retry.
        } finally {
            setLoadingMore(false);
        }
    };

    return(
        <div id="comments-section" className="comments-section">
            <div className="comments-section__divider"></div>

            <div className="comments-section__header">
                <span className="comments-section__count">
                    {total_comments > 0
                        ? `${total_comments} ${total_comments === 1 ? 'Comment' : 'Comments'}`
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
                hasMoreComments ?
                <button
                    onClick={loadMoreComments}
                    disabled={loadingMore}
                    className="comments-section__load-more"
                >
                    {loadingMore ? 'Loading…' : 'Load More Comments'}
                </button>
                : ""
            }
        </div>
    )
}

export default CommentsContainer;