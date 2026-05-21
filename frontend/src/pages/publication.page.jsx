import api from "../common/api";
import usePageTitle from "../common/usePageTitle";
import { useContext, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import NoDataMessage from "../components/nodata.component";
import LoadMoreDataBtn from "../components/load-more.component";
import BlogPostCard from "../components/blog-post.component";
import { filterPaginationData } from "../common/filter-pagination-data";
import SubscribeButton from "../components/subscribe-button.component";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import PageNotFound from "./404.page";
import { UserContext } from "../App";

const PublicationPage = () => {

    let { slug } = useParams();

    const [publication, setPublication] = useState(null);
    const [blogs, setBlogs] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const { userAuth: { access_token } } = useContext(UserContext);

    usePageTitle(publication?.title || 'Publication');

    // Track subscriber count locally for instant update
    const [localSubs, setLocalSubs] = useState(null);

    const fetchPublication = () => {
        api.post("/publication/get", { slug })
        .then(({ data }) => {
            setPublication(data.publication);
            setLocalSubs(data.publication.total_subscribers);
            fetchBlogs({ publication_id: data.publication._id });
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

    useEffect(() => {
        setLoading(true);
        setPublication(null);
        setBlogs(null);
        setNotFound(false);
        fetchPublication();
    }, [slug]);

    const handleSubscribeChange = (isNowSubscribed) => {
        setLocalSubs(prev => prev + (isNowSubscribed ? 1 : -1));
    };

    if (loading) return <Loader />;
    if (notFound || !publication) return <PageNotFound />;

    const { title, description, banner, owner, tags, total_posts, _id: pubId } = publication;
    const displaySubs = localSubs ?? publication.total_subscribers;

    return (
        <AnimationWrapper>
            <div className="publication-page">

                {/* Header */}
                <div className="publication-header">
                    {banner && (
                        <div className="publication-header__banner">
                            <img src={banner} alt={title} />
                        </div>
                    )}
                    <div className="publication-header__content">
                        <h1 className="publication-header__title">{title}</h1>
                        {description && (
                            <p className="publication-header__description">{description}</p>
                        )}

                        <Link to={`/user/${owner.personal_info.username}`} className="publication-header__owner">
                            <Avatar src={owner.personal_info.profile_img} alt={owner.personal_info.fullname} size={28} />
                            <span>by <strong>{owner.personal_info.fullname}</strong></span>
                        </Link>

                        <div className="publication-header__meta">
                            <span className="publication-stat">
                                <Icon name="group" className="publication-stat__icon" />
                                {displaySubs.toLocaleString()} subscribers
                            </span>
                            <span className="publication-stat">
                                <Icon name="article" className="publication-stat__icon" />
                                {total_posts.toLocaleString()} posts
                            </span>
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

                        <div className="publication-header__actions">
                            <SubscribeButton
                                publicationId={pubId}
                                onSubscribeChange={handleSubscribeChange}
                                size="md"
                            />
                        </div>
                    </div>
                </div>

                {/* Posts */}
                <div className="publication-posts">
                    <h2 className="publication-posts__heading">Latest Posts</h2>

                    {blogs == null ? <Loader /> :
                        blogs.results?.length ?
                            blogs.results.map((blog, i) => (
                                <AnimationWrapper key={blog.blog_id} transition={{ duration: 0.4, delay: i * 0.04 }}>
                                    <BlogPostCard
                                        content={blog}
                                        author={blog.author.personal_info}
                                    />
                                </AnimationWrapper>
                            ))
                        : <NoDataMessage message="No posts in this publication yet" />
                    }
                    <LoadMoreDataBtn state={blogs} fetchDataFun={fetchBlogs} />
                </div>
            </div>
        </AnimationWrapper>
    );
};

export default PublicationPage;
