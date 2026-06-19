import { useContext, useEffect, useState } from "react";
import usePageTitle from "../common/usePageTitle";
import { UserContext } from "../App";
import api from "../common/api";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import NoDataMessage from "../components/nodata.component";
import LoadMoreDataBtn from "../components/load-more.component";
import { filterPaginationData } from "../common/filter-pagination-data";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import { getDay } from "../common/date";
import toast from "react-hot-toast";

const BlockedUserCard = ({ user, blockedAt, onUnblock }) => {
    const [unblocking, setUnblocking] = useState(false);
    const { personal_info: { fullname, username, profile_img } } = user;

    const handleUnblock = () => {
        if (!window.confirm(`Unblock @${username}?`)) return;
        setUnblocking(true);
        onUnblock(user._id, () => setUnblocking(false));
    };

    return (
        <div className="blocked-user__card">
            <Avatar src={profile_img} alt={username} size={44} />
            <div className="blocked-user__info">
                <h3 className="text-sm font-semibold text-black">{fullname}</h3>
                <p className="text-xs text-dark-grey">@{username}</p>
                <p className="text-xs text-dark-grey/60 mt-0.5">Blocked {getDay(blockedAt)}</p>
            </div>
            <button
                className="blocked-user__unblock-btn"
                onClick={handleUnblock}
                disabled={unblocking}
            >
                {unblocking ? "..." : "Unblock"}
            </button>
        </div>
    );
};

const BlockedUsersPage = () => {

    usePageTitle("Blocked Users");

    const { userAuth: { access_token } } = useContext(UserContext);
    const [blockedUsers, setBlockedUsers] = useState(null);

    const fetchBlockedUsers = ({ page }) => {
        api.post("/blocked-users", { page })
        .then(async ({ data }) => {
            let formatedData = await filterPaginationData({
                state: blockedUsers,
                data: data.users,
                page,
                countRoute: "/blocked-users-count",
                user: access_token
            });
            setBlockedUsers(formatedData);
        })
        .catch(() => {});
    };

    useEffect(() => {
        if (access_token) {
            fetchBlockedUsers({ page: 1 });
        }
    }, [access_token]);

    const handleUnblock = (targetUserId, onDone) => {
        api.post("/unblock-user", { user_id: targetUserId })
        .then(() => {
            toast.success("User unblocked");
            setBlockedUsers(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    results: prev.results.filter(u => u.blocked._id !== targetUserId),
                    totalDocs: prev.totalDocs - 1
                };
            });
            onDone();
        })
        .catch(() => {
            toast.error("Failed to unblock user");
            onDone();
        });
    };

    return (
        <AnimationWrapper>
            <div>
                <h1 className="max-md:hidden">Blocked Users</h1>
                <p className="text-dark-grey text-sm mt-2 mb-8 max-md:mt-2">
                    Blocked users can't follow you, send messages, or see your content.
                </p>

                {blockedUsers == null ? <Loader /> :
                    blockedUsers.results.length ? (
                        <>
                            <div className="blocked-user__list">
                                {blockedUsers.results.map((item, i) => (
                                    <AnimationWrapper key={item.blocked._id || i} transition={{ delay: i * 0.05 }}>
                                        <BlockedUserCard
                                            user={item.blocked}
                                            blockedAt={item.blockedAt}
                                            onUnblock={handleUnblock}
                                        />
                                    </AnimationWrapper>
                                ))}
                            </div>
                            <LoadMoreDataBtn state={blockedUsers} fetchDataFun={fetchBlockedUsers} />
                        </>
                    ) : (
                        <NoDataMessage message="You haven't blocked anyone" />
                    )
                }
            </div>
        </AnimationWrapper>
    );
};

export default BlockedUsersPage;
