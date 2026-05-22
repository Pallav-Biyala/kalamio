import api from "../common/api";
import usePageTitle from "../common/usePageTitle";
import { useContext, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { UserContext } from "../App";
import { getSocket, disconnectSocket } from "../common/socket";
import ConversationList from "../components/conversation-list.component";
import ChatView from "../components/chat-view.component";
import Icon from "../components/Icon";
import Loader from "../components/loader.component";

const MessagesPage = () => {

    usePageTitle('Messages');

    const { userAuth: { access_token, _id: currentUserId } } = useContext(UserContext);
    const [searchParams] = useSearchParams();

    const [tab, setTab] = useState('dms'); // 'dms' | 'requests'
    const [conversations, setConversations] = useState(null);
    const [activeConv, setActiveConv] = useState(null);
    const [requestCount, setRequestCount] = useState(0);
    const [showSidebar, setShowSidebar] = useState(true);

    // Fetch conversations
    const fetchConversations = useCallback(() => {
        if (!access_token) return;

        const filter = tab === 'requests' ? 'requests' : 'dms';

        api.post("/conversations", { filter })
        .then(({ data }) => setConversations(data.conversations))
        .catch(() => setConversations([]));

        api.post("/message-request/count")
        .then(({ data }) => setRequestCount(data.totalDocs))
        .catch(() => {});
    }, [access_token, tab]);

    useEffect(() => {
        setConversations(null);
        fetchConversations();
    }, [fetchConversations]);

    // Handle ?user=<userId> query param (start chat from profile)
    useEffect(() => {
        const otherUserId = searchParams.get('user');
        if (!otherUserId || !access_token) return;

        api.post("/conversation/find", { other_user_id: otherUserId })
        .then(({ data }) => {
            if (data.conversation) {
                setActiveConv(data.conversation);
                setShowSidebar(false);
            } else {
                // No conversation yet — create one by sending the first message
                // For now, just set a temporary conversation shell
                api.post("/get-profile-by-id", { user_id: otherUserId })
                .then(({ data: userData }) => {
                    // User can type their first message to create the conversation
                })
                .catch(() => {});
            }
        })
        .catch(() => {});
    }, [searchParams, access_token]);

    // Socket.IO: listen for new messages to update conversation list
    useEffect(() => {
        if (!access_token) return;

        const socket = getSocket();
        if (!socket) return;

        const handleNewMessage = () => {
            fetchConversations();
        };

        socket.on('new_message', handleNewMessage);

        return () => {
            socket.off('new_message', handleNewMessage);
        };
    }, [access_token, fetchConversations]);

    const handleSelectConversation = (conv) => {
        setActiveConv(conv);
        setShowSidebar(false); // On mobile, hide sidebar when chat opens
    };

    const handleConversationUpdate = () => {
        fetchConversations();
    };

    return (
        <div className="messages-page">
            {/* Sidebar */}
            <div className={`messages-sidebar ${showSidebar ? '' : 'messages-sidebar--hidden-mobile'}`}>
                <div className="messages-sidebar__header">
                    <h2 className="messages-sidebar__title">Messages</h2>
                </div>

                <div className="messages-sidebar__tabs">
                    <button
                        className={`messages-tab ${tab === 'dms' ? 'messages-tab--active' : ''}`}
                        onClick={() => setTab('dms')}
                    >
                        <Icon name="chat" className="text-lg" />
                        Chats
                    </button>
                    <button
                        className={`messages-tab ${tab === 'requests' ? 'messages-tab--active' : ''}`}
                        onClick={() => setTab('requests')}
                    >
                        <Icon name="mark_chat_unread" className="text-lg" />
                        Requests
                        {requestCount > 0 && (
                            <span className="messages-tab__badge">{requestCount}</span>
                        )}
                    </button>
                </div>

                {conversations === null ? (
                    <Loader />
                ) : (
                    <ConversationList
                        conversations={conversations}
                        activeConvId={activeConv?._id}
                        onSelect={handleSelectConversation}
                    />
                )}
            </div>

            {/* Chat area */}
            <div className={`messages-chat ${!showSidebar ? '' : 'messages-chat--hidden-mobile'}`}>
                {!showSidebar && (
                    <button
                        className="messages-back-btn"
                        onClick={() => setShowSidebar(true)}
                    >
                        <Icon name="arrow_back" /> Back
                    </button>
                )}
                <ChatView
                    conversation={activeConv}
                    onConversationUpdate={handleConversationUpdate}
                />
            </div>
        </div>
    );
};

export default MessagesPage;
