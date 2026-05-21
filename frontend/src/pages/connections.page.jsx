import api from "../common/api";
import usePageTitle from "../common/usePageTitle";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

    const [tab, setTab] = useState('connections'); // 'connections' | 'pending'
    const [connections, setConnections] = useState(null);
    const [pending, setPending] = useState(null);
    const [pendingCount, setPendingCount] = useState(0);

    const fetchConnections = ({ page = 1 }) => {
        api.post("/connections", { page })
        .then(async ({ data }) => {
            let formatedData = await filterPaginationData({
                state: connections,
                data: data.users,
                page,
                countRoute: "/connections-count",
            });
            setConnections(formatedData);
        })
        .catch(() => {});
    };

    const fetchPending = ({ page = 1 }) => {
        api.post("/connect/pending", { page })
        .then(async ({ data }) => {
            let formatedData = await filterPaginationData({
                state: pending,
                data: data.users,
                page,
                countRoute: "/connect/pending-count",
            });
            setPending(formatedData);
        })
        .catch(() => {});
    };

    const fetchPendingCount = () => {
        api.post("/connect/pending-count")
        .then(({ data }) => setPendingCount(data.totalDocs))
        .catch(() => {});
    };

    useEffect(() => {
        if (!access_token) return;

        if (tab === 'connections') {
            setConnections(null);
            fetchConnections({ page: 1 });
        } else {
            setPending(null);
            fetchPending({ page: 1 });
        }

        fetchPendingCount();
    }, [access_token, tab]);

    const handleStatusChange = () => {
        // Refresh both lists after accept/decline
        setConnections(null);
        setPending(null);
        fetchConnections({ page: 1 });
        fetchPending({ page: 1 });
        fetchPendingCount();
    };

    const ConnectionCard = ({ user }) => {
        const { personal_info: { fullname, username, profile_img, bio }, _id } = user;
        return (
            <div className="connection-card">
                <Link to={`/user/${username}`} className="connection-card__user">
                    <Avatar src={profile_img} alt={fullname} size={48} />
                    <div className="connection-card__info">
                        <span className="connection-card__name">{fullname}</span>
                        <span className="connection-card__handle">@{username}</span>
                        {bio && <span className="connection-card__bio">{bio}</span>}
                    </div>
                </Link>
                <div className="connection-card__actions">
                    {tab === 'pending' ? (
                        <ConnectButton
                            targetUserId={_id}
                            initialStatus="pending_received"
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

    const currentData = tab === 'connections' ? connections : pending;

    return (
        <div>
            <h1 className="max-md:hidden">Connections</h1>

            <div className="my-8 flex gap-4">
                <button
                    className={"py-2 " + (tab === 'connections' ? "btn-dark" : "btn-light")}
                    onClick={() => setTab('connections')}
                >
                    <Icon name="handshake" className="text-lg mr-1 align-middle" />
                    Connections
                </button>
                <button
                    className={"py-2 relative " + (tab === 'pending' ? "btn-dark" : "btn-light")}
                    onClick={() => setTab('pending')}
                >
                    <Icon name="pending" className="text-lg mr-1 align-middle" />
                    Pending
                    {pendingCount > 0 && (
                        <span className="connect-pending-badge">{pendingCount}</span>
                    )}
                </button>
            </div>

            {currentData == null ? <Loader /> :
                <>
                    {currentData.results?.length ?
                        currentData.results.map((user, i) => (
                            <AnimationWrapper key={user._id || i} transition={{ delay: i * 0.06 }}>
                                <ConnectionCard user={user} />
                            </AnimationWrapper>
                        ))
                    : <NoDataMessage message={
                        tab === 'connections' 
                            ? "No connections yet. Visit profiles and send connect requests!" 
                            : "No pending requests"
                    } />}

                    <LoadMoreDataBtn
                        state={currentData}
                        fetchDataFun={tab === 'connections' ? fetchConnections : fetchPending}
                    />
                </>
            }
        </div>
    );
};

export default ConnectionsPage;
