import { useContext, useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserContext } from "../App";
import api from "../common/api";
import usePageTitle from "../common/usePageTitle";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../common/queryKeys";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import NoDataMessage from "../components/nodata.component";
import LoadMoreDataBtn from "../components/load-more.component";
import BlogPostCard from "../components/blog-post.component";
import TextPostCard from "../components/text-post-card.component";
import Icon from "../components/Icon";

const SubscriptionsPage = () => {

    usePageTitle("Subscriptions");

    const { userAuth: { access_token } } = useContext(UserContext);
    const navigate = useNavigate();

    const [selectedPub, setSelectedPub] = useState(null); // null = "All"
    const pubsScrollRef = useRef(null);

    // Redirect to signin if not logged in
    useEffect(() => {
        if (access_token === null) return; // still loading
        if (!access_token) {
            navigate("/signin");
        }
    }, [access_token]);

    // Fetch subscribed publications
    const { data: publications } = useQuery({
        queryKey: queryKeys.subscribe.mySubscriptions(),
        queryFn: async () => {
            const { data } = await api.post("/my-subscriptions");
            return data.publications;
        },
        enabled: !!access_token,
        staleTime: 10 * 60 * 1000,
    });

    // Subscription feed — infinite query
    const feedQuery = useInfiniteQuery({
        queryKey: [...queryKeys.subscribe.feed(), selectedPub?._id || 'all'],
        queryFn: async ({ pageParam = 1 }) => {
            const body = { page: pageParam };
            if (selectedPub) body.publication_id = selectedPub._id;

            const [blogsRes, countRes] = await Promise.all([
                api.post("/subscription-feed", body),
                pageParam === 1
                    ? api.post("/subscription-feed-count", selectedPub ? { publication_id: selectedPub._id } : {})
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
        select: (data) => {
            const blogs = data.pages.flatMap(p => p.blogs);
            return { blogs, totalDocs: data.pages[0]?.totalDocs ?? 0 };
        },
        enabled: !!access_token,
    });

    const blogs = feedQuery.data?.blogs || [];

    if (!access_token) return <Loader />;

    return (
        <AnimationWrapper>
            <section className="subscriptions-page">

                {/* ── Publication Avatars Row ──────────────── */}
                <div className="subscriptions-page__pubs-row">
                    {publications === undefined ? (
                        <div className="py-4 w-full flex justify-center"><Loader /></div>
                    ) : publications.length === 0 ? (
                        <div className="subscriptions-page__empty-pubs">
                            <Icon name="subscriptions" className="text-2xl text-dark-grey" />
                            <span className="text-dark-grey text-sm">No subscriptions yet</span>
                        </div>
                    ) : (
                        <div className="subscriptions-page__pubs-scroll" ref={pubsScrollRef}>
                            {/* "All" chip */}
                            <button
                                className={"subscriptions-page__pub-chip" + (selectedPub === null ? " active" : "")}
                                onClick={() => setSelectedPub(null)}
                            >
                                <div className="subscriptions-page__pub-avatar subscriptions-page__pub-avatar--all">
                                    <Icon name="grid_view" className="text-lg" />
                                </div>
                                <span className="subscriptions-page__pub-name">All</span>
                            </button>

                            {publications.map((pub) => (
                                <button
                                    key={pub._id}
                                    className={"subscriptions-page__pub-chip" + (selectedPub?._id === pub._id ? " active" : "")}
                                    onClick={() => setSelectedPub(pub)}
                                >
                                    <div className="subscriptions-page__pub-avatar">
                                        {pub.profile_photo ? (
                                            <img src={pub.profile_photo} alt="" />
                                        ) : (
                                            <span className="text-sm font-bold text-dark-grey">{pub.title.charAt(0).toUpperCase()}</span>
                                        )}
                                    </div>
                                    <span className="subscriptions-page__pub-name">{pub.title}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Selected Publication Card ──────────── */}
                {selectedPub && (
                    <div className="subscriptions-page__selected-card">
                        <div className="subscriptions-page__selected-top">
                            <div className="subscriptions-page__selected-avatar">
                                {selectedPub.profile_photo ? (
                                    <img src={selectedPub.profile_photo} alt="" />
                                ) : (
                                    <span className="text-3xl font-bold text-dark-grey">{selectedPub.title.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                            <div className="subscriptions-page__selected-text">
                                <h2 className="subscriptions-page__selected-title">{selectedPub.title}</h2>
                                {selectedPub.description && (
                                    <p className="subscriptions-page__selected-desc">{selectedPub.description}</p>
                                )}
                                <div className="subscriptions-page__selected-stats">
                                    <span><Icon name="article" className="text-sm" /> {selectedPub.total_posts} posts</span>
                                    <span><Icon name="group" className="text-sm" /> {selectedPub.total_subscribers} subscribers</span>
                                </div>
                            </div>
                        </div>
                        <Link to={`/publication/${selectedPub.slug}`} className="subscriptions-page__view-pub-btn">
                            <Icon name="open_in_new" className="text-base" />
                            View Publication
                        </Link>
                    </div>
                )}

                {/* ── Feed ──────────────────────────────────── */}
                <div className="subscriptions-page__feed">
                    {feedQuery.isLoading ? (
                        <Loader />
                    ) : blogs.length ? (
                        <>
                            {blogs.map((blog, i) => (
                                <AnimationWrapper
                                    key={blog.blog_id || blog._id}
                                    transition={{ duration: 0.4, delay: i * 0.04 }}
                                >
                                    {blog.type === 'text_post' ? (
                                        <TextPostCard
                                            content={blog}
                                            author={blog.author.personal_info}
                                        />
                                    ) : (
                                        <BlogPostCard
                                            content={blog}
                                            author={blog.author.personal_info}
                                        />
                                    )}
                                </AnimationWrapper>
                            ))}
                            <LoadMoreDataBtn
                                fetchNextPage={feedQuery.fetchNextPage}
                                hasNextPage={feedQuery.hasNextPage}
                                isFetchingNextPage={feedQuery.isFetchingNextPage}
                            />
                        </>
                    ) : (
                        <div className="subscriptions-page__empty-feed">
                            <Icon name="inbox" className="text-5xl text-dark-grey" />
                            <h3 className="font-bold text-xl mt-4">
                                {selectedPub ? "No posts yet" : "Your subscription feed is empty"}
                            </h3>
                            <p className="text-dark-grey mt-2">
                                {selectedPub
                                    ? `${selectedPub.title} hasn't published anything yet.`
                                    : "Subscribe to publications to see their latest content here."
                                }
                            </p>
                        </div>
                    )}
                </div>

            </section>
        </AnimationWrapper>
    );
};

export default SubscriptionsPage;
