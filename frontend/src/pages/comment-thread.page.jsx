import { useContext, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { UserContext } from "../App";
import { BlogContext } from "./blog.page";
import api from "../common/api";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../common/queryKeys";
import { getDay, getFullDay } from "../common/date";
import Loader from "../components/loader.component";
import AnimationWrapper from "../common/page-animation";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import CommentCard from "../components/comment-card.component";
import CommentField from "../components/comment-field.component";
import RightSidebar from "../components/right-sidebar.component";
import NoDataMessage from "../components/nodata.component";

const CommentThreadPage = () => {

    let { comment_id } = useParams();
    const navigate = useNavigate();
    let { userAuth: { access_token, username, profile_img, fullname } } = useContext(UserContext);

    const [replies, setReplies] = useState([]);
    const [totalRepliesLoaded, setTotalRepliesLoaded] = useState(0);
    const [totalParentCommentsLoaded, setTotalParentCommentsLoaded] = useState(0);

    // TanStack Query for the thread + initial replies
    const { data: threadData, isLoading } = useQuery({
        queryKey: queryKeys.comments.thread(comment_id),
        queryFn: async () => {
            const { data: { comment, ancestors, blog_context } } = await api.post("/get-comment-thread", { comment_id });
            const { data: { replies: fetchedReplies } } = await api.post("/get-replies", { _id: comment_id, skip: 0 });
            fetchedReplies.forEach(r => { r.childrenLevel = 0; });
            return { comment, ancestors: ancestors || [], blogContext: blog_context, initialReplies: fetchedReplies };
        },
        onSuccess: (data) => {
            setReplies(data.initialReplies);
            setTotalRepliesLoaded(data.initialReplies.length);
            setTotalParentCommentsLoaded(data.initialReplies.length);
        },
    });

    // Sync replies on first load (for TanStack Query v5 which doesn't have onSuccess)
    if (threadData && replies.length === 0 && threadData.initialReplies.length > 0) {
        setReplies(threadData.initialReplies);
        setTotalRepliesLoaded(threadData.initialReplies.length);
        setTotalParentCommentsLoaded(threadData.initialReplies.length);
    }

    const parentComment = threadData?.comment;
    const ancestors = threadData?.ancestors || [];
    const blogContext = threadData?.blogContext;

    const buildBlogObj = (blogCtx, repliesArr, comment) => {
        if (!blogCtx || !comment) return null;
        return {
            _id: blogCtx._id,
            title: comment.comment || '',
            text_content: comment.comment || '',
            type: 'text_post',
            author: {
                _id: blogCtx.author?._id,
                personal_info: blogCtx.author?.personal_info || {},
            },
            publishedAt: comment.commentedAt,
            comments: { results: repliesArr },
            activity: {
                total_comments: comment.children?.length || 0,
                total_parent_comments: comment.children?.length || 0,
            },
        };
    };

    const loadMoreReplies = () => {
        api.post("/get-replies", { _id: comment_id, skip: totalRepliesLoaded })
        .then(({ data: { replies: moreReplies } }) => {
            moreReplies.forEach(r => { r.childrenLevel = 0; });
            const newReplies = [...replies, ...moreReplies];
            setReplies(newReplies);
            setTotalRepliesLoaded(prev => prev + moreReplies.length);
            setTotalParentCommentsLoaded(prev => prev + moreReplies.length);
        })
        .catch(() => {});
    };

    if (isLoading) return <Loader />;
    if (!parentComment || !blogContext) return <NoDataMessage message="Comment not found" />;

    const blogObj = buildBlogObj(blogContext, replies, parentComment);
    const { personal_info: { profile_img: authorImg, fullname: authorName, username: authorUsername } } = blogContext.author;

    // ── Ancestor row component  ──
    const AncestorRow = ({ ancestor }) => {
        const { personal_info: { profile_img: aImg, fullname: aName, username: aUsername } } = ancestor.commented_by;
        return (
            <div className="comment-thread__ancestor">
                <div className="comment-thread__row">
                    <div className="comment-thread__avatar-col">
                        <Link to={`/user/${aUsername}`}>
                            <Avatar src={aImg} alt={aUsername} size={36} />
                        </Link>
                        <div className="comment-thread__line"></div>
                    </div>
                    <div className="comment-thread__content-col">
                        <div className="comment-thread__comment-header">
                            <Link to={`/user/${aUsername}`} className="comment-card__name">{aName}</Link>
                            <span className="comment-card__dot">·</span>
                            <span className="comment-card__time">{getDay(ancestor.commentedAt)}</span>
                        </div>
                        <Link to={`/comment/${ancestor._id}`} className="comment-thread__ancestor-link">
                            <p className="comment-card__text">{ancestor.comment}</p>
                        </Link>
                        <div className="comment-card__actions">
                            <button className="comment-card__action-btn">
                                <Icon name="favorite_border" />
                                <span>{ancestor.likes || 0}</span>
                            </button>
                            <button className="comment-card__action-btn">
                                <Icon name="chat_bubble_outline" />
                                <span>{ancestor.children?.length || 0}</span>
                            </button>
                            <button className="comment-card__action-btn">
                                <Icon name="repeat" />
                            </button>
                            <button className="comment-card__action-btn">
                                <Icon name="upload" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <AnimationWrapper>
            <BlogContext.Provider value={{
                blog: blogObj,
                setBlog: (newBlog) => {
                    if (newBlog.comments?.results) {
                        setReplies(newBlog.comments.results);
                    }
                },
                isLikedByUser: false,
                setLikedByUser: () => {},
                commentsWrapper: false,
                setCommentsWrapper: () => {},
                totalParentCommentsLoaded,
                setTotalParentCommentsLoaded,
            }}>
                <div className="home-layout">
                    <div className="home-feed max-lg:pt-0 lg:pt-10">
                        <div className="comment-thread-page max-lg:pt-4 max-lg:pb-6">
                            <div className="flex items-center gap-4 mb-6 lg:hidden">
                                <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full hover:bg-grey flex items-center justify-center transition-colors -ml-2">
                                    <Icon name="arrow_back" className="text-xl" />
                                </button>
                                <h1 className="font-semibold text-xl">Post</h1>
                            </div>
                    {/* ── Original Post Context (with thread line) ── */}
                    <div className="comment-thread__post-context">
                        <div className="comment-thread__row">
                            <div className="comment-thread__avatar-col">
                                <Link to={`/user/${authorUsername}`}>
                                    <Avatar src={authorImg} alt={authorUsername} size={40} />
                                </Link>
                                <div className="comment-thread__line"></div>
                            </div>
                            <div className="comment-thread__content-col">
                                <div className="comment-thread__post-header">
                                    <Link to={`/user/${authorUsername}`} className="comment-thread__post-author">{authorName}</Link>
                                    <span className="comment-thread__post-date">{getDay(blogContext.publishedAt)}</span>
                                </div>
                                <Link to={`/blog/${blogContext.blog_id}`} className="comment-thread__post-body">
                                    <p className="comment-thread__post-text">
                                        {blogContext.text_content || blogContext.title}
                                    </p>
                                </Link>
                                <div className="comment-card__actions">
                                    <button className="comment-card__action-btn">
                                        <Icon name="favorite_border" />
                                        <span>{blogContext.activity?.total_likes || 0}</span>
                                    </button>
                                    <button className="comment-card__action-btn">
                                        <Icon name="chat_bubble_outline" />
                                        <span>{blogContext.activity?.total_comments || 0}</span>
                                    </button>
                                    <button className="comment-card__action-btn">
                                        <Icon name="repeat" />
                                    </button>
                                    <button className="comment-card__action-btn">
                                        <Icon name="upload" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Ancestor Comments (parent chain) ── */}
                    {ancestors.map((ancestor) => (
                        <AncestorRow key={ancestor._id} ancestor={ancestor} />
                    ))}

                    {/* ── The Target Comment ── */}
                    <div className="comment-thread__main-comment">
                        <div className="comment-thread__row">
                            <div className="comment-thread__avatar-col">
                                <Link to={`/user/${parentComment.commented_by.personal_info.username}`}>
                                    <Avatar src={parentComment.commented_by.personal_info.profile_img} alt={parentComment.commented_by.personal_info.username} size={36} />
                                </Link>
                            </div>
                            <div className="comment-thread__content-col">
                                <div className="comment-thread__comment-header">
                                    <Link to={`/user/${parentComment.commented_by.personal_info.username}`} className="comment-card__name">
                                        {parentComment.commented_by.personal_info.fullname}
                                    </Link>
                                    <span className="comment-card__dot">·</span>
                                    <span className="comment-card__time">{getDay(parentComment.commentedAt)}</span>
                                </div>
                                <p className="comment-card__text">{parentComment.comment}</p>
                                <div className="comment-card__actions">
                                    <button className="comment-card__action-btn">
                                        <Icon name="favorite_border" />
                                        <span>{parentComment.likes || 0}</span>
                                    </button>
                                    <button className="comment-card__action-btn">
                                        <Icon name="chat_bubble_outline" />
                                        <span>{parentComment.children?.length || 0}</span>
                                    </button>
                                    <button className="comment-card__action-btn">
                                        <Icon name="repeat" />
                                    </button>
                                    <button className="comment-card__action-btn">
                                        <Icon name="upload" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Stats line */}
                        <div className="comment-thread__stats">
                            <span>{parentComment.likes || 0} {(parentComment.likes || 0) === 1 ? 'Like' : 'Likes'}</span>
                            <span className="comment-card__dot">·</span>
                            <span>{parentComment.children?.length || 0} {(parentComment.children?.length || 0) === 1 ? 'Reply' : 'Replies'}</span>
                            <span className="comment-card__dot">·</span>
                            <span>{getFullDay(parentComment.commentedAt)}</span>
                        </div>
                    </div>

                    {/* ── Replies Section ── */}
                    <div className="comment-thread__replies">
                        <CommentField action="Comment" replyingTo={parentComment._id} />

                        <div className="comments-section__list">
                            {replies.length > 0 ? 
                                replies.map((reply, i) => (
                                    <AnimationWrapper key={reply._id || i}>
                                        <CommentCard index={i} commentData={reply} isTextPost={true} />
                                    </AnimationWrapper>
                                ))
                                : <NoDataMessage message="No replies yet" />
                            }
                        </div>

                        {parentComment.children && totalRepliesLoaded < parentComment.children.length && (
                            <button 
                                onClick={loadMoreReplies}
                                className="comments-section__load-more"
                            >
                                Load More Replies
                            </button>
                        )}
                    </div>
                </div>
                </div>
                <RightSidebar />
            </div>
            </BlogContext.Provider>
        </AnimationWrapper>
    );
};

export default CommentThreadPage;
