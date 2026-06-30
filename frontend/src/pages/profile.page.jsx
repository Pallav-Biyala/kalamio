import api from "../common/api";
import usePageTitle from "../common/usePageTitle";
import { useContext, useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import { UserContext } from "../App";
import AboutUser from "../components/about.component";
import { filterPaginationData } from "../common/filter-pagination-data";
import BlogPostCard from "../components/blog-post.component";
import TextPostCard from "../components/text-post-card.component";
import NoDataMessage from "../components/nodata.component";
import LoadMoreDataBtn from "../components/load-more.component";
import InPageNavigation from "../components/inpage-navigation.component";
import PageNotFound from "./404.page";
import Icon from "../components/Icon";
import Avatar from "../components/Avatar";
import FollowButton from "../components/follow-button.component";

import SubscribeButton from "../components/subscribe-button.component";
import toast from "react-hot-toast";

export const profileDataStructure = {
    personal_info: {
        fullname: "",
        username: "",
        profile_img: "",
        bio: "" 
    },
    account_info: {
        total_posts: 0,
        total_reads: 0,
        total_followers: 0,
        total_following: 0,
    },
    social_links: {},
    joinedAt: ""
}

const ProfilePage = () => {

    let { id: profileId } = useParams();
    let { userAuth: { username, access_token } } = useContext(UserContext);
    profileId = profileId || username;

    const navigate = useNavigate();

    let [ profile, setProfile ] = useState(profileDataStructure);
    let [ loading, setLoading ] = useState(true);
    let [ blogs, setBlogs ] = useState(null);
    let [ profileLoaded, setProfileLoaded ] = useState("");
    let [ followsYou, setFollowsYou ] = useState(false);
    let [ publications, setPublications ] = useState(null);
    let [ isBlocked, setIsBlocked ] = useState(false);
    let [ profileCollections, setProfileCollections ] = useState([]);

    let { 
        personal_info: { fullname, username: profile_username, profile_img, bio }, 
        account_info: { total_posts, total_reads, total_followers, total_following },
        social_links, joinedAt, _id: profileUserId
        } = profile;

    usePageTitle(profile_username ? `@${profile_username}` : 'Profile');



    const fetchUserProfile = () => {
        api.post("/get-profile", {username: profileId})
        .then(({ data: user }) => {
            if(user != null){
                setProfile(user);

                // Check if this user follows you back (for badge)
                if(access_token && user._id !== username){
                    api.post("/is-following-back", { user_id: user._id })
                    .then(({ data: followData }) => setFollowsYou(followData.is_following_back))
                    .catch(() => {});

                    api.post("/is-blocked", { user_id: user._id })
                    .then(({ data: blockData }) => setIsBlocked(blockData.is_blocked && blockData.direction === 'blocker'))
                    .catch(() => {});
                }
            }
            setProfileLoaded(profileId);
            getBlogs({ user_id: user._id });
            fetchPublications(user._id);
            // Fetch user's public collections (or all if own profile)
            api.post("/collection/user-collections", { username: user.personal_info.username })
                .then(({ data: colData }) => setProfileCollections(colData.collections))
                .catch(() => {});
            setLoading(false);
        })
        .catch(err => {
            setLoading(false);
        })

    }

    const getBlogs = ({ page = 1, user_id }) => {

        user_id = user_id == undefined ? blogs.user_id : user_id;

        api.post("/search-blogs", {
            author: user_id,
            page
        })
        .then(async ({ data }) => {

            let formatedData = await filterPaginationData({
                state: blogs,
                data: data.blogs,
                page,
                countRoute: "/search-blogs-count",
                data_to_send: { author: user_id }
            })

            formatedData.user_id = user_id;

            setBlogs(formatedData);

        })

    }

    useEffect(() => {

        if(profileId != profileLoaded){
            setBlogs(null);
        }
        if(blogs == null){
            resetState();
            fetchUserProfile();
        }

    }, [profileId, blogs])

    const resetState = () => {
        setProfile(profileDataStructure);
        setLoading(true);
        setProfileLoaded("");
        setFollowsYou(false);
        setPublications(null);
    }

    const fetchPublications = (userId) => {
        api.post("/user-publications", { user_id: userId })
        .then(({ data }) => setPublications(data.publications))
        .catch(() => setPublications([]));
    };

    // Track follower count locally for instant UI update
    const [localFollowers, setLocalFollowers] = useState(null);
    useEffect(() => {
        setLocalFollowers(total_followers);
    }, [total_followers]);

    const handleFollowChange = (isNowFollowing) => {
        setLocalFollowers(prev => prev + (isNowFollowing ? 1 : -1));
    };

    const displayFollowers = localFollowers ?? total_followers;

    return (
      <AnimationWrapper>
        {loading ? (
          <Loader />
        ) : (
            profile_username.length ? 
                <section className="h-cover lg:flex flex-row-reverse items-start gap-5 min-[1100px]:gap-12 max-lg:pt-0">
                    <div className="flex flex-col max-lg:items-center gap-5 min-w-[250px] lg:max-w-[350px] w-full lg:pl-8 lg:border-l border-border lg:sticky lg:top-[100px] lg:py-10 ">
                        <div className="flex items-center gap-4 w-full lg:hidden mb-2 mt-4">
                            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full hover:bg-grey flex items-center justify-center transition-colors -ml-2">
                                <Icon name="arrow_back" className="text-xl" />
                            </button>
                            <h1 className="font-semibold text-xl">Profile</h1>
                        </div>
                    
                    {/* Avatar with gradient ring */}
                    <div className="relative">
                        <div className="w-32 h-32 rounded-full p-[3px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgb(var(--c-brand)), rgb(var(--c-accent)))' }}>
                            <Avatar src={profile_img} alt={fullname} size={120} />
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold">@{profile_username}</h1>
                    <p className="text-xl capitalize text-dark-grey">{fullname}</p>

                    {/* Follows you badge */}
                    {followsYou && profileId !== username && (
                        <span className="follows-you-badge">Follows you</span>
                    )}

                    {/* Stats badges */}
                    <div className="flex gap-3 flex-wrap">
                        <div className="flex items-center gap-2 bg-grey rounded-full py-2 px-4">
                            <Icon name="article" className="text-black text-xl" />
                            <p className="text-black font-semibold text-sm">{total_posts.toLocaleString()}</p>
                            <span className="text-dark-grey text-sm">Articles</span>
                        </div>
                        <div className="flex items-center gap-2 bg-grey rounded-full py-2 px-4">
                            <Icon name="visibility" className="text-black text-xl" />
                            <span className="font-semibold">{total_reads.toLocaleString()}</span>
                            <span className="text-dark-grey text-sm">Reads</span>
                        </div>
                        <div className="flex items-center gap-2 bg-grey rounded-full py-2 px-4">
                            <Icon name="group" className="text-black text-xl" />
                            <span className="font-semibold">{displayFollowers.toLocaleString()}</span>
                            <span className="text-dark-grey text-sm">Followers</span>
                        </div>
                        <div className="flex items-center gap-2 bg-grey rounded-full py-2 px-4">
                            <Icon name="person_add" className="text-black text-xl" />
                            <span className="font-semibold">{total_following.toLocaleString()}</span>
                            <span className="text-dark-grey text-sm">Following</span>
                        </div>

                    </div>

                    <div className="flex gap-4 mt-2">
                        {profileId == username ? (
                        <Link
                            to="/settings/edit-profile"
                            className="btn-light rounded-radius-md flex items-center gap-2"
                        >
                            <Icon name="edit" className="text-xl" />
                            Edit Profile
                        </Link>
                        ) : (
                        <div className="flex gap-3 flex-wrap">
                            <FollowButton
                                targetUserId={profileUserId}
                                onFollowChange={handleFollowChange}
                                size="md"
                            />

                            <button
                                className={isBlocked ? "profile-block-btn profile-block-btn--active" : "profile-block-btn"}
                                onClick={() => {
                                    if (isBlocked) {
                                        api.post("/unblock-user", { user_id: profileUserId })
                                        .then(() => { setIsBlocked(false); toast.success("User unblocked"); })
                                        .catch(() => toast.error("Failed to unblock"));
                                    } else {
                                        if (!window.confirm(`Block @${profile_username}? They won't be able to follow you or send messages.`)) return;
                                        api.post("/block-user", { user_id: profileUserId })
                                        .then(() => { setIsBlocked(true); toast.success("User blocked"); })
                                        .catch(() => toast.error("Failed to block"));
                                    }
                                }}
                                title={isBlocked ? "Unblock user" : "Block user"}
                            >
                                <Icon name="block" className="text-lg" />
                                {isBlocked ? "Unblock" : "Block"}
                            </button>
                        </div>
                        )}
                    </div>

                    <AboutUser
                        className="max-lg:hidden"
                        bio={bio}
                        social_links={social_links}
                        joinedAt={joinedAt}
                    />
                    </div>

                    <div className="max-lg:mt-12 w-full flex-1">
                    <InPageNavigation
                        routes={["All Published", "Publications", "Collections", "About"]}
                        defaultHidden={["About"]}
                    >

                        <>
                        {blogs == null ? (
                            <Loader />
                        ) : blogs.results.length ? (
                            blogs.results.map((blog, i) => {
                            return (
                                <AnimationWrapper
                                key={i}
                                transition={{ duration: 0.4, delay: i * 0.05 }}
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
                            );
                            })
                        ) : (
                            <NoDataMessage message="No posts published" />
                        )}
                        <LoadMoreDataBtn
                            state={blogs}
                            fetchDataFun={getBlogs}
                        />
                        </>

                        {/* Publications Tab */}
                        <>
                        {publications == null ? (
                            <Loader />
                        ) : publications.length ? (
                            publications.map((pub, i) => (
                                <AnimationWrapper key={pub._id} transition={{ duration: 0.4, delay: i * 0.05 }}>
                                    <div className="pub-profile-card">
                                        <Link to={`/publication/${pub.slug}`} className="pub-profile-card__title">
                                            <Icon name="import_contacts" className="pub-profile-card__icon" />
                                            {pub.title}
                                        </Link>
                                        {pub.description && (
                                            <p className="pub-profile-card__desc">{pub.description}</p>
                                        )}
                                        <div className="pub-profile-card__meta">
                                            <span><Icon name="group" className="text-sm" /> {pub.total_subscribers} subscribers</span>
                                            <span><Icon name="article" className="text-sm" /> {pub.total_posts} posts</span>
                                        </div>
                                        <SubscribeButton publicationId={pub._id} size="sm" />
                                    </div>
                                </AnimationWrapper>
                            ))
                        ) : (
                            <NoDataMessage message="No publications yet" />
                        )}
                        </>

                        {/* Collections Tab */}
                        <>
                            {profileCollections.length > 0 ? (
                                <div className="saved-page__grid">
                                    {profileCollections.map(col => (
                                        <Link key={col._id} to={`/collection/${col._id}`} className="saved-collection-card">
                                            <div className="saved-collection-card__cover">
                                                {col.cover_image
                                                    ? <img src={col.cover_image} alt={col.title} />
                                                    : <div className="saved-collection-card__cover-placeholder">
                                                        <Icon name={col.is_default ? 'schedule' : 'collections_bookmark'} className="text-3xl" />
                                                    </div>
                                                }
                                                <span className="saved-collection-card__count">
                                                    {col.total_articles} {col.total_articles === 1 ? 'article' : 'articles'}
                                                </span>
                                            </div>
                                            <div className="saved-collection-card__info">
                                                <h3 className="saved-collection-card__title">{col.title}</h3>
                                                <span className="saved-collection-card__visibility">
                                                    <Icon name={col.visibility === 'public' ? 'public' : 'link'} className="text-xs" />
                                                    {col.visibility}
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <NoDataMessage message="No public collections" />
                            )}
                        </>

                        <AboutUser bio={bio} social_links={social_links} joinedAt={joinedAt} />
                        
                    </InPageNavigation>
                    </div>
                </section>
            : <PageNotFound />
        )}
      </AnimationWrapper>
    );
}

export default ProfilePage;