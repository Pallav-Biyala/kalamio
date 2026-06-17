import api from "../common/api";
import usePageTitle from "../common/usePageTitle";
import { createContext, useContext, useEffect, useState } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import { getDay } from "../common/date";
import BlogInteraction from "../components/blog-interaction.component";
import BlogPostCard from "../components/blog-post.component";
import BlogContent from "../components/blog-content.component";
import CommentsContainer, { fetchComments } from "../components/comments.component";
import { saveReadingProgress } from "../components/keep-reading.component";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import FollowButton from "../components/follow-button.component";
import SubscribeButton from "../components/subscribe-button.component";
import RightSidebar from "../components/right-sidebar.component";
import { UserContext } from "../App";
import toast from "react-hot-toast";

// Inline poll component for the blog page detail view
const TextPostPollView = ({ poll: initialPoll, blogId }) => {
    const { userAuth: { access_token } } = useContext(UserContext);
    const [poll, setPoll] = useState(initialPoll);
    const [hasVoted, setHasVoted] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);

    useEffect(() => {
        if (access_token && initialPoll && initialPoll.options && initialPoll.options.length > 0) {
            api.post("/check-poll-vote", { blog_id: blogId })
            .then(({ data }) => {
                if (data.hasVoted) {
                    setHasVoted(true);
                    setSelectedOption(data.option_index);
                }
            })
            .catch(() => {});
        }
    }, [access_token, initialPoll, blogId]);

    const handleVote = (optionIndex) => {
        if (hasVoted || !access_token) {
            if (!access_token) toast.error("Please login to vote");
            return;
        }
        setSelectedOption(optionIndex);
        setHasVoted(true);

        setPoll(prev => {
            const updated = { ...prev };
            updated.options = prev.options.map((opt, i) => ({
                ...opt,
                votes: i === optionIndex ? opt.votes + 1 : opt.votes
            }));
            updated.total_votes = (prev.total_votes || 0) + 1;
            return updated;
        });

        api.post("/vote-poll", { blog_id: blogId, option_index: optionIndex })
        .then(({ data }) => setPoll(data.poll))
        .catch(() => {
            toast.error("Vote failed");
            setPoll(initialPoll);
            setHasVoted(false);
            setSelectedOption(null);
        });
    };

    return (
        <div className="feed-card__text-post-poll mb-6">
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
                        <div key={i}
                            className={`feed-card__text-post-poll-option ${hasVoted ? 'feed-card__text-post-poll-option--voted' : ''} ${selectedOption === i ? 'feed-card__text-post-poll-option--selected' : ''}`}
                            onClick={() => !hasVoted && handleVote(i)}
                        >
                            {hasVoted && <div className="feed-card__text-post-poll-bar" style={{ width: `${percent}%` }} />}
                            <div className="feed-card__text-post-poll-label">
                                <span className="feed-card__text-post-poll-text">
                                    {!hasVoted && (
                                        <span className="feed-card__text-post-poll-radio" />
                                    )}
                                    {hasVoted && selectedOption === i && (
                                        <Icon name="check_circle" className="feed-card__text-post-poll-check" />
                                    )}
                                    {opt.text}
                                </span>
                                {hasVoted && <span className="feed-card__text-post-poll-percent">{percent}%</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="feed-card__text-post-poll-footer">
                <span>{poll.total_votes || 0} vote{(poll.total_votes || 0) !== 1 ? 's' : ''}</span>
            </div>
        </div>
    );
};


export const blogStructure = {
    title: '',
    des: '',
    content: [],
    author: { personal_info: { } },
    banner: '',
    publishedAt: ''
}

export const BlogContext = createContext({  })

const BlogPage = () => {

    let { blog_id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [ blog, setBlog ] = useState(blogStructure);
    const [ similarBlogs, setSimilarBlogs ] = useState(null);
    const [ loading, setLoading ] = useState(true);
    const [ isLikedByUser, setLikedByUser ] = useState(false);
    const [ commentsWrapper, setCommentsWrapper ] = useState(false);
    const [ totalParentCommentsLoaded, setTotalParentCommentsLoaded ] = useState(0);

    let { title, content, banner, author: { personal_info: { fullname, username: author_username, profile_img, bio }, account_info: { total_posts: author_total_posts, total_reads: author_total_reads } = {} }, publishedAt, publication, type, text_content, images, poll: blogPoll } = blog;

    const isTextPost = type === 'text_post';
    usePageTitle(isTextPost ? (text_content ? text_content.substring(0, 60) : 'Text Post') : (title || 'Blog'));

    const fetchBlog = () => {
        api.post("/get-blog", { blog_id })
        .then(async ({ data: { blog } }) => {
            
            if (!blog.draft) {
                blog.comments = await fetchComments({ blog_id: blog._id, setParentCommentCountFun: setTotalParentCommentsLoaded })
            }

            setBlog(blog);

            // Save for Keep Reading widget (only for published)
            if (!blog.draft) {
                saveReadingProgress(blog);

                if (blog.tags && blog.tags.length > 0) {
                    api.post("/search-blogs", { tag: blog.tags[0], limit: 6, eliminate_blog: blog_id })
                    .then(({ data }) => {
                        setSimilarBlogs(data.blogs);
                    })
                }
            }

            setLoading(false);
        })
        .catch(err => {
            // If 403 because it's a draft, retry with draft flag
            if (err.response?.status === 403 && err.response?.data?.error?.includes("draft")) {
                api.post("/get-blog", { blog_id, draft: true, mode: 'edit' })
                .then(async ({ data: { blog } }) => {
                    setBlog(blog);
                    setLoading(false);
                })
                .catch(() => {
                    setLoading(false);
                })
            } else {
                setLoading(false);
            }
        })
    }

    useEffect(() => {

        resetStates();
        window.scrollTo(0, 0);
        fetchBlog();

        if (location.state?.openComments) {
            setCommentsWrapper(true);
        }

    }, [blog_id])

    const resetStates = () => {
        setBlog(blogStructure);
        setSimilarBlogs(null);
        setLoading(true);
        setLikedByUser(false);
        setCommentsWrapper(false);
        setTotalParentCommentsLoaded(0);
    }

    let isDraft = blog.draft;

    return (
        <AnimationWrapper>
            {
                loading ? <Loader />
                :
                <BlogContext.Provider value={{ blog, setBlog, isLikedByUser, setLikedByUser, commentsWrapper, setCommentsWrapper, totalParentCommentsLoaded, setTotalParentCommentsLoaded }}>
                    <div className={isTextPost ? "home-layout" : ""}>
                        <div className={isTextPost ? "home-feed max-lg:pt-0 lg:pt-10" : ""}>
                            <div className={`max-w-[900px] w-full center max-lg:px-[5vw] ${isTextPost ? 'max-lg:pt-0 max-lg:pb-6 lg:py-10' : 'max-lg:pt-0 max-lg:pb-10 lg:py-10'}`}>

                        {isDraft && (
                            <div className="draft-preview-banner">
                                <Icon name="visibility_off" className="text-lg" />
                                <span>Draft Preview — This is only visible to you</span>
                                {!isTextPost && (
                                    <Link to={`/editor/${blog_id}`} className="draft-preview-banner__edit">
                                        <Icon name="edit" className="text-base" />
                                        Edit Draft
                                    </Link>
                                )}
                            </div>
                        )}

                        {isTextPost ? (
                            /* ── Text Post View ── */
                            <div>
                                <div className="flex items-center gap-4 mb-6 lg:hidden">
                                    <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full hover:bg-grey flex items-center justify-center transition-colors -ml-2">
                                        <Icon name="arrow_back" className="text-xl" />
                                    </button>
                                    <h1 className="font-semibold text-xl">Post</h1>
                                </div>
                                <div className="flex gap-5 items-start mb-6">
                                    <Avatar src={profile_img} alt={fullname} size={48} />
                                    <div>
                                        <p className="capitalize font-semibold">{fullname}</p>
                                        <div className="flex items-center gap-2 text-dark-grey text-sm">
                                            <Link to={`/user/${author_username}`} className="hover:text-black transition-colors">@{author_username}</Link>
                                            <span>·</span>
                                            <span>{isDraft ? "Draft" : getDay(publishedAt)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-lg leading-relaxed whitespace-pre-wrap mb-6" style={{ lineHeight: '1.8' }}>
                                    {text_content}
                                </div>

                                {images && images.length > 0 && (
                                    <div className={`feed-card__text-post-images feed-card__text-post-images--${Math.min(images.length, 4)} mb-6`}>
                                        {images.map((url, i) => (
                                            <img key={i} src={url} alt={`Image ${i + 1}`} className="feed-card__text-post-image" />
                                        ))}
                                    </div>
                                )}

                                {blogPoll && blogPoll.options && blogPoll.options.length > 0 && (
                                    <TextPostPollView poll={blogPoll} blogId={blog_id} />
                                )}

                                {!isDraft && <BlogInteraction />}
                            </div>
                        ) : (
                            /* ── Article View (existing) ── */
                            <>
                                <div className="flex items-center gap-4 mb-6 lg:hidden">
                                    <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full hover:bg-grey flex items-center justify-center transition-colors -ml-2">
                                        <Icon name="arrow_back" className="text-xl" />
                                    </button>
                                    <span className="font-semibold text-xl text-dark-grey">Article</span>
                                </div>
                                

                                <div className="max-w-[700px] mx-auto mt-4 md:mt-8">
                                    <h1 className="text-4xl md:text-5xl font-bold font-gelasio leading-tight md:leading-[1.1] text-black mb-8 tracking-tight">{title}</h1>

                                    <div className="flex items-center gap-4 mb-6">
                                        <Avatar src={profile_img} alt={fullname} size={48} />
                                        <div className="flex flex-col">
                                            <p className="font-semibold text-black capitalize">
                                                {fullname}
                                            </p>
                                            <p className="text-dark-grey text-sm mt-0.5 flex items-center gap-1.5">
                                                {isDraft ? "Draft" : getDay(publishedAt)}
                                                {publication && (
                                                    <>
                                                        <span className="text-grey/50">•</span>
                                                        <span>Published in</span>
                                                        <Link to={`/publication/${publication.slug}`} className="text-black hover:underline transition-colors font-medium">
                                                            {publication.title}
                                                        </Link>
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {!isDraft && (
                                        <div className="mb-8">
                                            <BlogInteraction />
                                        </div>
                                    )}
                                </div>

                                {banner && (
                                    <div className="my-8 md:my-12 max-sm:-mx-[5vw] sm:max-w-[800px] sm:mx-auto">
                                        <img 
                                            src={banner} 
                                            className="w-full aspect-video md:aspect-[2/1] object-cover sm:rounded-2xl shadow-xl shadow-black/5" 
                                            alt={title} 
                                        />
                                    </div>
                                )}

                                <div className="max-w-[700px] mx-auto">
                                    <div className="my-8 font-merriweather blog-page-content" style={{ lineHeight: '1.9' }}>
                                        <BlogContent content={content} />
                                    </div>

                                    {!isDraft && <BlogInteraction />}
                                </div>
                            </>
                        )}

                        {!isDraft && <CommentsContainer />}
                    </div>

                    {/* ── Footer Section (CTAs & Similar Blogs) ── */}
                    {!isDraft && (
                    <div className="border-t border-border py-10 mt-10 sm:mt-16">
                        <div className="max-w-[900px] center max-lg:px-[5vw]">
                            {/* ── CTA Section ── */}
                            <div className="blog-cta-section !mt-0">

                            {/* Author CTA */}
                            <div className="blog-cta-card">
                                <div className="blog-cta-card__header">
                                    <span className="blog-cta-card__label">Written by</span>
                                </div>
                                <div className="blog-cta-card__body">
                                    <Link to={`/user/${author_username}`} className="blog-cta-card__avatar-link">
                                        <Avatar src={profile_img} alt={fullname} size={56} />
                                    </Link>
                                    <div className="blog-cta-card__info">
                                        <Link to={`/user/${author_username}`} className="blog-cta-card__name">{fullname}</Link>
                                        <p className="blog-cta-card__username">@{author_username}</p>
                                        {bio && <p className="blog-cta-card__bio">{bio}</p>}
                                        <div className="blog-cta-card__stats">
                                            <span><Icon name="article" className="text-sm" /> {author_total_posts || 0} posts</span>
                                            <span><Icon name="visibility" className="text-sm" /> {(author_total_reads || 0).toLocaleString()} reads</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="blog-cta-card__actions">
                                    <Link to={`/user/${author_username}`} className="blog-cta-card__btn">View Profile</Link>
                                    <FollowButton targetUserId={blog.author._id} size="sm" />
                                </div>
                            </div>

                            {/* Publication CTA */}
                            {publication && (
                                <div className="blog-cta-card blog-cta-card--pub">
                                    <div className="blog-cta-card__header">
                                        <span className="blog-cta-card__label">
                                            <Icon name="import_contacts" className="text-sm" /> Published in
                                        </span>
                                    </div>
                                    <div className="blog-cta-card__body">
                                        <div className="blog-cta-card__pub-icon-wrap">
                                            {publication.profile_photo ? (
                                                <img src={publication.profile_photo} alt={publication.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <Icon name="menu_book" className="blog-cta-card__pub-icon" />
                                            )}
                                        </div>
                                        <div className="blog-cta-card__info">
                                            <Link to={`/publication/${publication.slug}`} className="blog-cta-card__name">{publication.title}</Link>
                                            {publication.description && <p className="blog-cta-card__bio">{publication.description}</p>}
                                            <div className="blog-cta-card__stats">
                                                <span><Icon name="group" className="text-sm" /> {publication.total_subscribers || 0} subscribers</span>
                                                <span><Icon name="article" className="text-sm" /> {publication.total_posts || 0} posts</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="blog-cta-card__actions">
                                        <Link to={`/publication/${publication.slug}`} className="blog-cta-card__btn">View Publication</Link>
                                        <SubscribeButton publicationId={publication._id} size="sm" />
                                    </div>
                                </div>
                            )}

                        </div>

                        {
                            similarBlogs != null && similarBlogs.length ?
                                <>
                                    <h1 className="text-2xl mt-14 mb-10 font-semibold flex items-center gap-2">
                                        Similar Blogs
                                    </h1>

                                    {
                                        similarBlogs.map((blog, i) => {

                                            let { author: { personal_info } } = blog;

                                            return <AnimationWrapper key={i} transition={{duration: 0.4, delay: i*0.05}}>
                                                <BlogPostCard content={blog} author={personal_info} />
                                            </AnimationWrapper>

                                        })
                                    }
                                </>
                            : ""
                        }
                        </div>
                    </div>
                    )}
                        </div>
                        {isTextPost && <RightSidebar />}
                    </div>
                </BlogContext.Provider>
            }
        </AnimationWrapper>
    )
}

export default BlogPage;