import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import AnimationWrapper from "../common/page-animation";
import Loader from "./loader.component";
import NoDataMessage from "./nodata.component";
import MinimalBlogPost from "./nobanner-blog-post.component";
import WhoToFollow from "./who-to-follow.component";
import { useTrendingBlogs } from "../hooks/queries";

const RightSidebar = ({ onTrendingClick }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  // TanStack Query — shared cache across all RightSidebar instances + HomePage
  const { data: trendingBlogs, isLoading } = useTrendingBlogs();

  const handleTrendingClick = () => {
    if (onTrendingClick) {
        onTrendingClick();
    } else {
        navigate("/search/trending");
    }
  };

  return (
    <aside className="home-sidebar">
      {/* Search Bar */}
      <div className="desktop-top-bar__search mb-4">
        <Icon name="search" className="text-lg text-dark-grey" />
        <input
          type="text"
          placeholder="Search"
          className="desktop-top-bar__search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && searchQuery.length) navigate(`/search/${encodeURIComponent(searchQuery)}`); }}
        />
        {searchQuery.length > 0 && (
          <div className="flex items-center gap-1">
            <button onClick={() => setSearchQuery("")} className="text-dark-grey hover:text-black flex items-center justify-center p-0.5 transition-colors">
              <Icon name="close" className="text-lg" />
            </button>
          </div>
        )}
      </div>

      {/* Trending Now */}
      <div className="home-sidebar__section">
        <div className="home-sidebar__header">
          <div className="home-sidebar__title">
            <Icon name="trending_up" /> Trending Now
          </div>
          <span className="home-sidebar__view-all" onClick={handleTrendingClick}>View all</span>
        </div>

        <div className="home-sidebar__list">
          {isLoading ? (
            <Loader />
          ) : (
            trendingBlogs?.length ?
                trendingBlogs.slice(0, 5).map((blog, i) => {
                // `once`: trending banners are cached — don't replay the fade every time this
                // sidebar remounts, which looked like the images were reloading.
                return (
                    <AnimationWrapper
                    key={blog.blog_id}
                    once={blog.blog_id}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    >
                    <MinimalBlogPost blog={blog} index={i} />
                    </AnimationWrapper>
                );
                })
            : <NoDataMessage message="No trending blogs"/>
          )}
        </div>
      </div>

      {/* Who to Follow */}
      <WhoToFollow />

      {/* Footer links */}
      <div className="home-sidebar__footer">
        <a href="#" className="home-sidebar__footer-link">About</a>
        <a href="#" className="home-sidebar__footer-link">Help</a>
        <a href="#" className="home-sidebar__footer-link">Terms</a>
        <a href="#" className="home-sidebar__footer-link">Privacy</a>
        <a href="https://www.candiq.app/feedback/907oynz-" target="_blank" rel="noopener noreferrer" className="home-sidebar__footer-link">Feedback</a>
      </div>
    </aside>
  );
};

export default RightSidebar;
