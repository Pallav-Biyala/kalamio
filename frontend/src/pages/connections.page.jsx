import api from "../common/api";
import usePageTitle from "../common/usePageTitle";
import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getDay } from "../common/date";
import { UserContext } from "../App";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../common/queryKeys";
import Loader from "../components/loader.component";
import AnimationWrapper from "../common/page-animation";
import NoDataMessage from "../components/nodata.component";
import LoadMoreDataBtn from "../components/load-more.component";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import ConnectButton from "../components/connect-button.component";

// Helper — creates an infinite query for a connections endpoint
const useConnectionsList = (endpoint, countEndpoint, enabled) => {
    return useInfiniteQuery({
        queryKey: [...queryKeys.connections.all(), endpoint],
        queryFn: async ({ pageParam = 1 }) => {
            const [usersRes, countRes] = await Promise.all([
                api.post(endpoint, { page: pageParam }),
                pageParam === 1
                    ? api.post(countEndpoint)
                    : Promise.resolve(null),
            ]);

            return {
                users: usersRes.data.users,
                totalDocs: countRes?.data?.totalDocs ?? undefined,
                page: pageParam,
            };
        },
        getNextPageParam: (lastPage, allPages) => {
            const totalLoaded = allPages.reduce((sum, p) => sum + p.users.length, 0);
            const totalDocs = allPages[0]?.totalDocs ?? 0;
            if (totalLoaded < totalDocs) return lastPage.page + 1;
            return undefined;
        },
        select: (data) => ({
            users: data.pages.flatMap(p => p.users),
            totalDocs: data.pages[0]?.totalDocs ?? 0,
        }),
        enabled,
    });
};

const ConnectionsPage = () => {

    usePageTitle('Connections');

    let { userAuth: { access_token } } = useContext(UserContext);
    const queryClient = useQueryClient();

    const [tab, setTab] = useState('connections'); // 'connections' | 'received' | 'sent'
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();

    // Three separate queries — only the active tab fetches
    const connectionsQuery = useConnectionsList("/connections", "/connections-count", !!access_token);
    const pendingQuery = useConnectionsList("/connect/pending", "/connect/pending-count", !!access_token);
    const sentQuery = useConnectionsList("/connect/sent", "/connect/sent-count", !!access_token);

    // Badge counts from the queries
    const pendingCount = pendingQuery.data?.totalDocs ?? 0;

    const handleStatusChange = () => {
        // Invalidate all connection queries after accept/decline/withdraw
        queryClient.invalidateQueries({ queryKey: queryKeys.connections.all() });
    };

    const ConnectionCard = ({ user, acceptedAt }) => {
        const { personal_info: { fullname, username, profile_img, bio }, _id } = user;
        return (
            <div className="connection-card">
                <Link to={`/user/${username}`} className="connection-card__user">
                    <Avatar src={profile_img} alt={fullname} size={48} />
                    <div className="connection-card__info">
                        <span className="connection-card__name">{fullname}</span>
                        <span className="connection-card__handle">@{username}</span>
                        {tab === 'connections' && acceptedAt && (
                            <span className="connection-card__since">Connected {getDay(acceptedAt)}</span>
                        )}
                        {bio && <span className="connection-card__bio">{bio}</span>}
                    </div>
                </Link>
                <div className="connection-card__actions">
                    {tab === 'connections' && (
                        <button
                            className="connection-card__msg-btn"
                            onClick={(e) => { e.preventDefault(); navigate(`/messages?user=${username}`); }}
                            title="Send message"
                        >
                            <Icon name="chat_bubble_outline" className="text-[20px]" />
                        </button>
                    )}
                    {tab === 'received' ? (
                        <ConnectButton
                            targetUserId={_id}
                            initialStatus="pending_received"
                            onStatusChange={handleStatusChange}
                            size="sm"
                        />
                    ) : tab === 'sent' ? (
                        <ConnectButton
                            targetUserId={_id}
                            initialStatus="pending_sent"
                            onStatusChange={handleStatusChange}
                            size="sm"
                        />
                    ) : (
                        <ConnectButton
                            targetUserId={_id}
                            initialStatus="accepted"
                            size="sm"
                        />
                    )}
                </div>
            </div>
        );
    };

    const activeQuery = tab === 'connections' ? connectionsQuery : tab === 'received' ? pendingQuery : sentQuery;
    const users = activeQuery.data?.users || [];

    return (
        <div>
            <h1 className="max-md:hidden">Connections</h1>

            <div className="my-8 flex gap-4 flex-wrap">
                <button
                    className={"py-2 " + (tab === 'connections' ? "btn-dark" : "btn-light")}
                    onClick={() => setTab('connections')}
                >
                    <Icon name="handshake" className="text-lg mr-1 align-middle" />
                    Connections
                </button>
                <button
                    className={"py-2 relative " + (tab === 'received' ? "btn-dark" : "btn-light")}
                    onClick={() => setTab('received')}
                >
                    <Icon name="call_received" className="text-lg mr-1 align-middle" />
                    Received
                    {pendingCount > 0 && (
                        <span className="connect-pending-badge">{pendingCount}</span>
                    )}
                </button>
                <button
                    className={"py-2 relative " + (tab === 'sent' ? "btn-dark" : "btn-light")}
                    onClick={() => setTab('sent')}
                >
                    <Icon name="call_made" className="text-lg mr-1 align-middle" />
                    Sent
                </button>
            </div>

            {/* Search bar — only for connections tab */}
            {tab === 'connections' && (
                <div className="relative mb-6">
                    <input
                        type="search"
                        className="w-full bg-grey p-3 pl-10 rounded-full placeholder:text-dark-grey text-sm"
                        placeholder="Search connections..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-dark-grey" />
                </div>
            )}

            {activeQuery.isLoading ? <Loader /> :
                <>
                    {(() => {
                        const filtered = searchQuery.trim()
                            ? users.filter(u => {
                                const q = searchQuery.toLowerCase();
                                const pi = u.personal_info || {};
                                return (pi.fullname || '').toLowerCase().includes(q) ||
                                       (pi.username || '').toLowerCase().includes(q);
                            })
                            : users;
                        return filtered.length ?
                            filtered.map((user, i) => (
                                <AnimationWrapper key={user._id || i} transition={{ delay: i * 0.06 }}>
                                    <ConnectionCard user={user} acceptedAt={user.acceptedAt} />
                                </AnimationWrapper>
                            ))
                        : <NoDataMessage message={
                            searchQuery.trim() ? "No connections match your search" :
                            tab === 'connections'
                                ? "No connections yet. Visit profiles and send connect requests!"
                                : tab === 'received'
                                ? "No pending requests received"
                                : "No pending requests sent"
                        } />
                    })()}

                    <LoadMoreDataBtn
                        fetchNextPage={activeQuery.fetchNextPage}
                        hasNextPage={activeQuery.hasNextPage}
                        isFetchingNextPage={activeQuery.isFetchingNextPage}
                    />
                </>
            }
        </div>
    );
};

export default ConnectionsPage;
