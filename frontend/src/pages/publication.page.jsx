import usePageTitle from "../common/usePageTitle";
import { useContext, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "../common/queryKeys";
import api from "../common/api";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import NoDataMessage from "../components/nodata.component";
import LoadMoreDataBtn from "../components/load-more.component";
import BlogPostCard from "../components/blog-post.component";
import TextPostCard from "../components/text-post-card.component";
import SubscribeButton from "../components/subscribe-button.component";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import PageNotFound from "./404.page";
import { UserContext } from "../App";
import PublicationMenu from "../components/publication-menu.component";
import InPageNavigation from "../components/inpage-navigation.component";
import AboutPublication from "../components/about-publication.component";

// Helper: creates an infinite query for a publication's blog feed
const usePubFeed = (publicationId, type) => {
    return useInfiniteQuery({
        queryKey: [...queryKeys.publications.detail(''), 'feed', publicationId, type || 'all'],
        queryFn: async ({ pageParam = 1 }) => {
            const body = { publication_id: publicationId, page: pageParam };
            if (type) body.type = type;

            const [blogsRes, countRes] = await Promise.all([
                api.post("/publication/blogs", body),
                pageParam === 1
                    ? api.post("/publication/blogs-count", { publication_id: publicationId, ...(type ? { type } : {}) })
                    : Promise.resolve(null),
            ]);

            return {
                blogs: blogsRes.data.blogs,
                totalDocs: countRes?.data?.totalDocs ?? undefined,
                page: pageParam,
            };
        },
        getNextPageParam: (lastPage, allPages) => {
            const totalLoaded = allPages.reduce((sum, p) => sum + p.blogs.length, 0);
            const totalDocs = allPages[0]?.totalDocs ?? 0;
            if (totalLoaded < totalDocs) return lastPage.page + 1;
            return undefined;
        },
        select: (data) => ({
            blogs: data.pages.flatMap(p => p.blogs),
            totalDocs: data.pages[0]?.totalDocs ?? 0,
        }),
        enabled: !!publicationId,
    });
};

const PublicationPage = () => {

    let { slug } = useParams();
    const navigate = useNavigate();

    const { userAuth: { access_token, username } } = useContext(UserContext);

    // Track subscriber count locally for instant update
    const [localSubs, setLocalSubs] = useState(null);

    // Fetch publication metadata
    const { data: pubData, isLoading, isError } = useQuery({
        queryKey: queryKeys.publications.detail(slug),
        queryFn: async () => {
            const { data } = await api.post("/publication/get", { slug });
            return data.publication;
        },
        staleTime: 10 * 60 * 1000,
    });

    const publication = pubData;
    const pubId = publication?._id;

    // Sync localSubs when publication data loads
    if (publication && localSubs === null) {
        setLocalSubs(publication.total_subscribers);
    }

    usePageTitle(publication?.title || 'Publication');

    // 3 separate infinite queries for each tab
    const allFeedQuery = usePubFeed(pubId, null);
    const articlesFeedQuery = usePubFeed(pubId, 'blog');
    const textPostsFeedQuery = usePubFeed(pubId, 'text_post');

    // Publication collections
    const { data: pubCollections = [] } = useQuery({
        queryKey: [...queryKeys.collections.all(), 'publication', pubId],
        queryFn: async () => {
            const { data } = await api.post("/collection/publication-collections", { publication_id: pubId });
            return data.collections;
        },
        enabled: !!pubId,
        staleTime: 10 * 60 * 1000,
    });

    const handleSubscribeChange = (isNowSubscribed) => {
        setLocalSubs(prev => prev + (isNowSubscribed ? 1 : -1));
    };

    if (isLoading) return <Loader />;
    if (isError || !publication) return <PageNotFound />;

    const { title, description, banner, profile_photo, owner, tags, total_posts } = publication;
    const displaySubs = localSubs ?? publication.total_subscribers;

    const allBlogs = allFeedQuery.data?.blogs || [];
    const articlesBlogs = articlesFeedQuery.data?.blogs || [];
    const textPostsBlogs = textPostsFeedQuery.data?.blogs || [];

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
                            {allFeedQuery.isLoading ? <Loader /> :
                                allBlogs.length ?
                                    allBlogs.map((blog, i) => (
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
                            <LoadMoreDataBtn
                                fetchNextPage={allFeedQuery.fetchNextPage}
                                hasNextPage={allFeedQuery.hasNextPage}
                                isFetchingNextPage={allFeedQuery.isFetchingNextPage}
                            />
                        </>

                        {/* Articles Tab */}
                        <>
                            {articlesFeedQuery.isLoading ? <Loader /> :
                                articlesBlogs.length ?
                                    articlesBlogs.map((blog, i) => (
                                        <AnimationWrapper key={blog.blog_id} transition={{ duration: 0.4, delay: i * 0.04 }}>
                                            <BlogPostCard content={blog} author={blog.author.personal_info} />
                                        </AnimationWrapper>
                                    ))
                                : <NoDataMessage message="No articles in this publication yet" />
                            }
                            <LoadMoreDataBtn
                                fetchNextPage={articlesFeedQuery.fetchNextPage}
                                hasNextPage={articlesFeedQuery.hasNextPage}
                                isFetchingNextPage={articlesFeedQuery.isFetchingNextPage}
                            />
                        </>

                        {/* Posts Tab */}
                        <>
                            {textPostsFeedQuery.isLoading ? <Loader /> :
                                textPostsBlogs.length ?
                                    textPostsBlogs.map((blog, i) => (
                                        <AnimationWrapper key={blog.blog_id} transition={{ duration: 0.4, delay: i * 0.04 }}>
                                            <TextPostCard content={blog} author={blog.author.personal_info} />
                                        </AnimationWrapper>
                                    ))
                                : <NoDataMessage message="No text posts in this publication yet" />
                            }
                            <LoadMoreDataBtn
                                fetchNextPage={textPostsFeedQuery.fetchNextPage}
                                hasNextPage={textPostsFeedQuery.hasNextPage}
                                isFetchingNextPage={textPostsFeedQuery.isFetchingNextPage}
                            />
                        </>

                        {/* Collections Tab */}
                        <>
                            {publication.owner?.personal_info?.username === username && (
                                <button
                                    className="btn-dark btn-sm mb-4"
                                    onClick={() => {
                                        const title = prompt('Collection name:');
                                        if (!title?.trim()) return;
                                        api.post('/collection/create', {
                                            title: title.trim(),
                                            publication_id: publication._id,
                                            visibility: 'public'
                                        }).catch(() => {});
                                    }}
                                >
                                    <Icon name="add" className="text-lg" /> New Collection
                                </button>
                            )}
                            {pubCollections.length === 0
                                ? <NoDataMessage message="No collections in this publication yet" />
                                : <div className="saved-page__grid">
                                    {pubCollections.map(col => (
                                        <Link key={col._id} to={`/collection/${col._id}`} className="saved-collection-card">
                                            <div className="saved-collection-card__cover">
                                                {col.cover_image
                                                    ? <img src={col.cover_image} alt={col.title} />
                                                    : <div className="saved-collection-card__cover-placeholder">
                                                        <Icon name="collections_bookmark" className="text-3xl" />
                                                    </div>
                                                }
                                                <span className="saved-collection-card__count">
                                                    {col.total_articles} {col.total_articles === 1 ? 'article' : 'articles'}
                                                </span>
                                            </div>
                                            <div className="saved-collection-card__info">
                                                <h3 className="saved-collection-card__title">{col.title}</h3>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            }
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
