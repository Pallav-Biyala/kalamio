import api from "../common/api";
import usePageTitle from "../common/usePageTitle";
import { useContext, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import NoDataMessage from "../components/nodata.component";
import LoadMoreDataBtn from "../components/load-more.component";
import BlogPostCard from "../components/blog-post.component";
import TextPostCard from "../components/text-post-card.component";
import { filterPaginationData } from "../common/filter-pagination-data";
import SubscribeButton from "../components/subscribe-button.component";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import PageNotFound from "./404.page";
import { UserContext } from "../App";
import PublicationMenu from "../components/publication-menu.component";
import InPageNavigation from "../components/inpage-navigation.component";
import AboutPublication from "../components/about-publication.component";

const PublicationPage = () => {

    let { slug } = useParams();
    const navigate = useNavigate();

    const [publication, setPublication] = useState(null);
    const [blogs, setBlogs] = useState(null);
    const [articles, setArticles] = useState(null);
    const [textPosts, setTextPosts] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const { userAuth: { access_token, username } } = useContext(UserContext);

    usePageTitle(publication?.title || 'Publication');

    // Track subscriber count locally for instant update
    const [localSubs, setLocalSubs] = useState(null);

    const fetchPublication = () => {
        api.post("/publication/get", { slug })
        .then(({ data }) => {
            setPublication(data.publication);
            setLocalSubs(data.publication.total_subscribers);
            fetchBlogs({ publication_id: data.publication._id });
            fetchArticles({ publication_id: data.publication._id });
            fetchTextPosts({ publication_id: data.publication._id });
            setLoading(false);
        })
        .catch(() => {
            setNotFound(true);
            setLoading(false);
        });
    };

    const fetchBlogs = ({ page = 1, publication_id }) => {
        publication_id = publication_id || publication?._id;

        api.post("/publication/blogs", { publication_id, page })
        .then(async ({ data }) => {
            let formatedData = await filterPaginationData({
                state: blogs,
                data: data.blogs,
                page,
                countRoute: "/publication/blogs-count",
                data_to_send: { publication_id }
            });
            setBlogs(formatedData);
        })
        .catch(() => {});
    };

    const fetchArticles = ({ page = 1, publication_id }) => {
        publication_id = publication_id || publication?._id;

        api.post("/publication/blogs", { publication_id, page, type: 'blog' })
        .then(async ({ data }) => {
            let formatedData = await filterPaginationData({
                state: articles,
                data: data.blogs,
                page,
                countRoute: "/publication/blogs-count",
                data_to_send: { publication_id, type: 'blog' }
            });
            setArticles(formatedData);
        })
        .catch(() => {});
    };

    const fetchTextPosts = ({ page = 1, publication_id }) => {
        publication_id = publication_id || publication?._id;

        api.post("/publication/blogs", { publication_id, page, type: 'text_post' })
        .then(async ({ data }) => {
            let formatedData = await filterPaginationData({
                state: textPosts,
                data: data.blogs,
                page,
                countRoute: "/publication/blogs-count",
                data_to_send: { publication_id, type: 'text_post' }
            });
            setTextPosts(formatedData);
        })
        .catch(() => {});
    };

    useEffect(() => {
        setLoading(true);
        setPublication(null);
        setBlogs(null);
        setArticles(null);
        setTextPosts(null);
        setNotFound(false);
        fetchPublication();
    }, [slug]);

    const handleSubscribeChange = (isNowSubscribed) => {
        setLocalSubs(prev => prev + (isNowSubscribed ? 1 : -1));
    };

    if (loading) return <Loader />;
    if (notFound || !publication) return <PageNotFound />;

    const { title, description, banner, profile_photo, owner, tags, total_posts, _id: pubId } = publication;
    const displaySubs = localSubs ?? publication.total_subscribers;

    return (
        <AnimationWrapper>
            <div className="publication-page">

                {/* Header */}
                <div className="publication-header">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="publication-header__back-btn"
                        aria-label="Go back"
                    >
                        <Icon name="arrow_back" />
                    </button>
                    {banner && (
                        <div className="publication-header__banner">
                            <img src={banner} alt={title} />
                        </div>
                    )}
                    <div className="publication-header__content">
                        {/* Row: profile photo + info */}
                        <div className="publication-header__identity">
                            <div className="publication-header__profile-photo">
                                {profile_photo ? (
                                    <img src={profile_photo} alt={title} />
                                ) : (
                                    <span className="publication-header__profile-placeholder">
                                        {title.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <div className="publication-header__info">
                                <h1 className="publication-header__title">{title}</h1>
                                <div className="publication-header__meta-line">
                                    <Link to={`/user/${owner.personal_info.username}`} className="publication-header__handle">
                                        @{owner.personal_info.username}
                                    </Link>
                                    <span className="publication-header__meta-dot">·</span>
                                    <span>{displaySubs.toLocaleString()} subscribers</span>
                                    <span className="publication-header__meta-dot">·</span>
                                    <span>{total_posts.toLocaleString()} articles</span>
                                </div>
                                {description && (
                                    <div className="publication-header__description-wrapper">
                                        <span className="publication-header__description">{description}</span>
                                        <button 
                                            className="publication-header__more-btn"
                                            onClick={() => document.querySelector('[data-tab="About"]')?.click()}
                                        >
                                            ...more
                                        </button>
                                    </div>
                                )}
                                <div className="publication-header__actions">
                                    <SubscribeButton
                                        publicationId={pubId}
                                        onSubscribeChange={handleSubscribeChange}
                                        size="md"
                                    />
                                    <PublicationMenu 
                                        publicationId={pubId} 
                                        ownerId={owner._id}
                                        ownerUsername={owner.personal_info.username}
                                        isOwner={username === owner.personal_info.username}
                                        onSubscribeChange={handleSubscribeChange}
                                    />
                                </div>
                            </div>
                        </div>

                        {tags?.length > 0 && (
                            <div className="publication-header__tags">
                                {tags.map((tag, i) => (
                                    <Link key={i} to={`/search/${tag}`} className="publication-tag">
                                        {tag}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full mt-4 px-4 md:px-0">
                    <InPageNavigation 
                        routes={["Home", "Articles", "Posts", "Collections", "About"]}
                        className="rounded-2xl"
                    >
                        
                        {/* Home Tab */}
                        <>
                            {blogs == null ? <Loader /> :
                                blogs.results?.length ?
                                    blogs.results.map((blog, i) => (
                                        <AnimationWrapper key={blog.blog_id} transition={{ duration: 0.4, delay: i * 0.04 }}>
                                            {blog.type === 'text_post' ? (
                                                <TextPostCard content={blog} author={blog.author.personal_info} />
                                            ) : (
                                                <BlogPostCard content={blog} author={blog.author.personal_info} />
                                            )}
                                        </AnimationWrapper>
                                    ))
                                : <NoDataMessage message="No posts in this publication yet" />
                            }
                            <LoadMoreDataBtn state={blogs} fetchDataFun={fetchBlogs} />
                        </>

                        {/* Articles Tab */}
                        <>
                            {articles == null ? <Loader /> :
                                articles.results?.length ?
                                    articles.results.map((blog, i) => (
                                        <AnimationWrapper key={blog.blog_id} transition={{ duration: 0.4, delay: i * 0.04 }}>
                                            <BlogPostCard content={blog} author={blog.author.personal_info} />
                                        </AnimationWrapper>
                                    ))
                                : <NoDataMessage message="No articles in this publication yet" />
                            }
                            <LoadMoreDataBtn state={articles} fetchDataFun={fetchArticles} />
                        </>

                        {/* Posts Tab */}
                        <>
                            {textPosts == null ? <Loader /> :
                                textPosts.results?.length ?
                                    textPosts.results.map((blog, i) => (
                                        <AnimationWrapper key={blog.blog_id} transition={{ duration: 0.4, delay: i * 0.04 }}>
                                            <TextPostCard content={blog} author={blog.author.personal_info} />
                                        </AnimationWrapper>
                                    ))
                                : <NoDataMessage message="No text posts in this publication yet" />
                            }
                            <LoadMoreDataBtn state={textPosts} fetchDataFun={fetchTextPosts} />
                        </>

                        {/* Collections Tab */}
                        <>
                            <NoDataMessage message="No Collections" />
                        </>

                        {/* About Tab */}
                        <AboutPublication 
                            description={publication.description} 
                            social_links={publication.social_links}
                            createdAt={publication.createdAt}
                            total_reads={publication.total_reads}
                        />

                    </InPageNavigation>
                </div>
            </div>
        </AnimationWrapper>
    );
};

export default PublicationPage;
