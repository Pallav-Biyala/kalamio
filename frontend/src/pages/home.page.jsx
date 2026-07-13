import usePageTitle from "../common/usePageTitle";
import Icon from "../components/Icon";
import AnimationWrapper from "../common/page-animation";
import { useContext, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../common/queryKeys";
import Loader from "../components/loader.component";
import BlogPostCard from "../components/blog-post.component";
import TextPostCard from "../components/text-post-card.component";
import TextPostComposer from "../components/text-post-composer.component";
import NoDataMessage from "../components/nodata.component";
import LoadMoreDataBtn from "../components/load-more.component";
import RightSidebar from "../components/right-sidebar.component";
import Avatar from "../components/Avatar";
import { UserContext } from "../App";
import NetworkError from "../components/network-error.component";
import { useLatestBlogs, useCategoryBlogs, useTrendingBlogs, useFollowingFeed } from "../hooks/queries";

const HomePage = () => {
  const [pageState, setPageState] = useState("home");
  const [trendingFilter, setTrendingFilter] = useState("all");
  const [showComposer, setShowComposer] = useState(false);
  const [editingTextPostId, setEditingTextPostId] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { userAuth: { access_token, profile_img } } = useContext(UserContext);

  usePageTitle(pageState === "home" ? "Kalamio" : `#${pageState}`);

  // Determine active category tag (null when home/following/trending)
  const activeTag = (pageState !== "home" && pageState !== "following" && pageState !== "trending")
    ? pageState : null;

  // ── Query hooks ─────────────────────────────────────────────
  const latestQuery = useLatestBlogs();
  const categoryQuery = useCategoryBlogs(activeTag);
  const trendingQuery = useTrendingBlogs();
  const followingQuery = useFollowingFeed();

  // Pick the right feed query based on pageState
  const activeFeedQuery = activeTag ? categoryQuery : latestQuery;
  const activeFeedData = activeFeedQuery.data;

  let categories = [
    "For You",
    "Following",
    "Trending",
    "AI",
    "Money",
    "Self Growth",
    "Productivity",
    "Technology",
    "Life",
    "Fitness",
  ];

  const tabsRef = useRef(null);
  const tabsSpacerRef = useRef(null);

  // Keep spacer height in sync — on mobile, tabs are always fixed so spacer is always needed
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');

    const updateSpacer = () => {
      if (!tabsSpacerRef.current || !tabsRef.current) return;
      tabsSpacerRef.current.style.height = mql.matches
        ? tabsRef.current.offsetHeight + 'px'
        : '0px';
    };

    updateSpacer();
    mql.addEventListener('change', updateSpacer);
    window.addEventListener('resize', updateSpacer);
    
    const resizeObserver = new ResizeObserver(updateSpacer);
    if (tabsRef.current) resizeObserver.observe(tabsRef.current);

    return () => {
      mql.removeEventListener('change', updateSpacer);
      window.removeEventListener('resize', updateSpacer);
      resizeObserver.disconnect();
    };
  }, []);

  const loadBlogByCategory = (category) => {
    window.scrollTo(0, 0);

    if (category === "For You") {
      setPageState("home");
      return;
    }

    if (category === "Trending") {
      setPageState("trending");
      return;
    }

    if (category === "Following") {
      setPageState("following");
      return;
    }

    let tag = category.toLowerCase();
    if (pageState === tag) {
      setPageState("home");
      return;
    }

    setPageState(tag);
  };

  // Helper to render a blog card
  const renderBlogCard = (blog, i) => (
    <AnimationWrapper
      key={blog.blog_id}
      transition={{ duration: 0.4, delay: i * 0.04 }}
    >
      {blog.type === 'text_post' ? (
        <TextPostCard
          content={blog}
          author={blog.author.personal_info}
          onEdit={(blogId) => { setEditingTextPostId(blogId); setShowComposer(true); }}
        />
      ) : (
        <BlogPostCard
          content={blog}
          author={blog.author.personal_info}
        />
      )}
    </AnimationWrapper>
  );

  return (
    <AnimationWrapper>
      <div className="home-layout">

        {/* ── Main Feed Column ──────────────────── */}
        <div className="home-feed">

          {/* Sticky Feed Header */}
          <div className="feed-sticky-header">
            {/* Composer Prompt */}
            <div className="composer-prompt" onClick={() => access_token ? setShowComposer(true) : navigate("/signin")}>
                <div className="composer-prompt__avatar">
                    {profile_img ? (
                        <Avatar src={profile_img} size={36} />
                    ) : (
                        <div className="w-[36px] h-[36px] rounded-full bg-grey flex items-center justify-center text-dark-grey">
                            <Icon name="person" className="text-[20px]" />
                        </div>
                    )}
                </div>
                <span className="composer-prompt__input">Write to the world...</span>
                <div className="flex items-center gap-1 text-dark-grey ml-auto">
                    <div className="w-[44px] h-[44px] rounded-full hover:bg-grey flex items-center justify-center transition-colors" title="Add images">
                        <Icon name="image" className="text-[26px] text-brand" />
                    </div>
                    <div className="w-[44px] h-[44px] rounded-full hover:bg-grey flex items-center justify-center transition-colors" title="Add poll">
                        <Icon name="poll" className="text-[26px] text-brand" />
                    </div>
                </div>
            </div>

            {/* Category tabs */}
            <div className="category-tabs" ref={tabsRef}>

              {categories.map((category, i) => {
                const isActive = 
                  (category === "For You" && pageState === "home") ||
                  (category === "Following" && pageState === "following") ||
                  (category === "Trending" && pageState === "trending") ||
                  (category !== "For You" && category !== "Following" && category !== "Trending" && pageState === category.toLowerCase());

                return (
                  <button
                    key={i}
                    onClick={() => loadBlogByCategory(category)}
                    className={"category-tabs__item" + (isActive ? " active" : "")}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Spacer: fills the gap when category-tabs switches to position:fixed */}
          <div ref={tabsSpacerRef} className="category-tabs-spacer" style={{ height: 0 }} />

          {/* Blog feed */}
          <div className="home-feed__list">
            {pageState === "following" ? (
              // Following feed
              !access_token ? (
                <NoDataMessage message="Sign in to see blogs from people you follow" />
              ) : followingQuery.isError ? (
                <NetworkError onRetry={() => followingQuery.refetch()} />
              ) : followingQuery.isLoading ? (
                <Loader />
              ) : followingQuery.data?.blogs?.length ? (
                <>
                  {followingQuery.data.blogs.map((blog, i) => renderBlogCard(blog, i))}
                  <LoadMoreDataBtn
                    fetchNextPage={followingQuery.fetchNextPage}
                    hasNextPage={followingQuery.hasNextPage}
                    isFetchingNextPage={followingQuery.isFetchingNextPage}
                  />
                </>
              ) : (
                <div className="following-empty">
                  <Icon name="group_add" className="following-empty__icon" />
                  <h3 className="following-empty__title">Your Following feed is empty</h3>
                  <p className="following-empty__text">Follow writers to see their blogs here. Check out "Who to follow" in the sidebar!</p>
                </div>
              )
            ) : pageState === "trending" ? (
              <>
                <div className="trending-subtabs">
                  {[{key:"today",label:"Today"},{key:"week",label:"This Week"},{key:"month",label:"This Month"},{key:"all",label:"All Time"}].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setTrendingFilter(tab.key)}
                      className={"trending-subtabs__item" + (trendingFilter === tab.key ? " active" : "")}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {trendingQuery.isError ? (
                  <NetworkError onRetry={() => trendingQuery.refetch()} />
                ) : trendingQuery.isLoading ? (
                  <Loader />
                ) :
                  (() => {
                    const now = new Date();
                    const filtered = (trendingQuery.data || []).filter(b => {
                      if (trendingFilter === "all") return true;
                      const published = new Date(b.publishedAt);
                      const diffDays = (now - published) / (1000 * 60 * 60 * 24);
                      if (trendingFilter === "today") return diffDays <= 1;
                      if (trendingFilter === "week") return diffDays <= 7;
                      if (trendingFilter === "month") return diffDays <= 30;
                      return true;
                    });
                    return filtered.length ?
                      filtered.map((blog, i) => renderBlogCard(blog, i))
                    : <NoDataMessage message="No trending blogs for this period" />
                  })()}
              </>
            ) : activeFeedQuery.isError ? (
              <NetworkError onRetry={() => activeFeedQuery.refetch()} />
            ) : activeFeedQuery.isLoading ? (
              <Loader />
            ) : (
              activeFeedData?.blogs?.length ?
                  activeFeedData.blogs.map((blog, i) => renderBlogCard(blog, i))
              : <NoDataMessage message="No blogs published"/>
            )}
            {pageState !== "following" && pageState !== "trending" && (
              <LoadMoreDataBtn
                fetchNextPage={activeFeedQuery.fetchNextPage}
                hasNextPage={activeFeedQuery.hasNextPage}
                isFetchingNextPage={activeFeedQuery.isFetchingNextPage}
              />
            )}
          </div>
        </div>

        {/* ── Right Sidebar Column (Desktop) ───── */}
        <RightSidebar onTrendingClick={() => loadBlogByCategory("Trending")} />

      </div>


      {/* Text Post Composer Modal */}
      <TextPostComposer
        isOpen={showComposer}
        onClose={() => { setShowComposer(false); setEditingTextPostId(null); }}
        editBlogId={editingTextPostId}
        onPosted={() => {
            // Invalidate feed queries — TanStack Query handles the refetch
            queryClient.invalidateQueries({ queryKey: queryKeys.blogs.latest() });
            queryClient.invalidateQueries({ queryKey: queryKeys.blogs.following() });
        }}
      />
    </AnimationWrapper>
  );
};

export default HomePage;
