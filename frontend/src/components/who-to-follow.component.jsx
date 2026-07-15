import { useContext } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../common/api";
import { queryKeys } from "../common/queryKeys";
import { UserContext } from "../App";
import Avatar from "./Avatar";
import FollowButton from "./follow-button.component";
import { useBatchFollowStatus } from "../hooks/queries";

const WhoToFollow = () => {

    const { userAuth: { username: currentUser, access_token } } = useContext(UserContext);

    // Fetch suggested users
    const { data: users } = useQuery({
        queryKey: queryKeys.users.suggestions(),
        queryFn: async () => {
            const { data } = await api.post("/search-users", { query: "" });
            return data.users
                .filter(u => u.personal_info.username !== currentUser)
                .slice(0, 4);
        },
        staleTime: 10 * 60 * 1000,
    });

    // Batch follow status
    const userIds = users?.map(u => u._id).filter(Boolean) || [];
    const { data: followStatus } = useBatchFollowStatus(userIds);

    if (!users || users.length === 0) return null;

    return (
        <div className="home-sidebar__section">
            <div className="home-sidebar__header">
                <div className="home-sidebar__title">
                    Who to follow
                </div>
                <span className="home-sidebar__view-all">View all</span>
            </div>

            <div className="who-to-follow__list">
                {users.map((user, i) => {
                    const { fullname, username, profile_img } = user.personal_info;
                    const isFollowing = followStatus ? followStatus.following?.includes(user._id) : null;
                    const followsYou = followStatus ? followStatus.followers?.includes(user._id) : null;
                    return (
                        <div key={i} className="who-to-follow__item">
                            <Link to={`/user/${username}`} className="who-to-follow__user">
                                <Avatar src={profile_img} alt={fullname} size={36} />
                                <div className="who-to-follow__info">
                                    <span className="who-to-follow__name">{fullname}</span>
                                    <span className="who-to-follow__handle">@{username}</span>
                                </div>
                            </Link>
                            {access_token ? (
                                <FollowButton
                                    targetUserId={user._id}
                                    initiallyFollowing={isFollowing}
                                    initiallyFollowsYou={followsYou}
                                    size="sm"
                                />
                            ) : (
                                <Link
                                    to="/signin"
                                    className="who-to-follow__follow-btn"
                                >
                                    Follow
                                </Link>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default WhoToFollow;
