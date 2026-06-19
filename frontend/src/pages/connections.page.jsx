import api from "../common/api";
import usePageTitle from "../common/usePageTitle";
import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getDay } from "../common/date";
import { UserContext } from "../App";
import Loader from "../components/loader.component";
import AnimationWrapper from "../common/page-animation";
import NoDataMessage from "../components/nodata.component";
import LoadMoreDataBtn from "../components/load-more.component";
import { filterPaginationData } from "../common/filter-pagination-data";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import ConnectButton from "../components/connect-button.component";

const ConnectionsPage = () => {

    usePageTitle('Connections');

    let { userAuth: { access_token } } = useContext(UserContext);

    const [tab, setTab] = useState('connections'); // 'connections' | 'received' | 'sent'
    const [connections, setConnections] = useState(null);
    const [pending, setPending] = useState(null);
    const [sent, setSent] = useState(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [sentCount, setSentCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();

    const fetchConnections = ({ page = 1 }) => {
        api.post("/connections", { page })
        .then(async ({ data }) => {
            setConnections(prev => {
                const currentState = page === 1 ? null : prev;
                filterPaginationData({
                    state: currentState,
                    data: data.users,
                    page,
                    countRoute: "/connections-count",
                }).then(formatedData => setConnections(formatedData));
                return prev;
            });
        })
        .catch(() => {});
    };

    const fetchPending = ({ page = 1 }) => {
        api.post("/connect/pending", { page })
        .then(async ({ data }) => {
            setPending(prev => {
                const currentState = page === 1 ? null : prev;
                filterPaginationData({
                    state: currentState,
                    data: data.users,
                    page,
                    countRoute: "/connect/pending-count",
                }).then(formatedData => setPending(formatedData));
                return prev;
            });
        })
        .catch(() => {});
    };

    const fetchSent = ({ page = 1 }) => {
        api.post("/connect/sent", { page })
        .then(async ({ data }) => {
            setSent(prev => {
                const currentState = page === 1 ? null : prev;
                filterPaginationData({
                    state: currentState,
                    data: data.users,
                    page,
                    countRoute: "/connect/sent-count",
                }).then(formatedData => setSent(formatedData));
                return prev;
            });
        })
        .catch(() => {});
    };

    const fetchCounts = () => {
        api.post("/connect/pending-count")
        .then(({ data }) => setPendingCount(data.totalDocs))
        .catch(() => {});

        api.post("/connect/sent-count")
        .then(({ data }) => setSentCount(data.totalDocs))
        .catch(() => {});
    };

    useEffect(() => {
        if (!access_token) return;

        if (tab === 'connections') {
            setConnections(null);
            fetchConnections({ page: 1 });
        } else if (tab === 'received') {
            setPending(null);
            fetchPending({ page: 1 });
        } else {
            setSent(null);
            fetchSent({ page: 1 });
        }

        fetchCounts();
    }, [access_token, tab]);

    const handleStatusChange = () => {
        // Refresh all lists after accept/decline/withdraw
        setConnections(null);
        setPending(null);
        setSent(null);
        fetchConnections({ page: 1 });
        fetchPending({ page: 1 });
        fetchSent({ page: 1 });
        fetchCounts();
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

    const currentData = tab === 'connections' ? connections : tab === 'received' ? pending : sent;
    const currentFetchFn = tab === 'connections' ? fetchConnections : tab === 'received' ? fetchPending : fetchSent;

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

            {currentData == null ? <Loader /> :
                <>
                    {(() => {
                        const filtered = searchQuery.trim()
                            ? currentData.results.filter(u => {
                                const q = searchQuery.toLowerCase();
                                const pi = u.personal_info || {};
                                return (pi.fullname || '').toLowerCase().includes(q) ||
                                       (pi.username || '').toLowerCase().includes(q);
                            })
                            : currentData.results;
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
                        state={currentData}
                        fetchDataFun={currentFetchFn}
                    />
                </>
            }
        </div>
    );
};

export default ConnectionsPage;
