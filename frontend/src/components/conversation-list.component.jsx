import { Link } from "react-router-dom";
import Avatar from "./Avatar";

const ConversationList = ({ conversations, activeConvId, onSelect }) => {

    if (!conversations?.length) {
        return (
            <div className="conv-list__empty">
                <p>No conversations yet</p>
                <span>Visit a profile and tap the message icon to start chatting.</span>
            </div>
        );
    }

    return (
        <div className="conv-list">
            {conversations.map(conv => {
                const other = conv.other_user;
                if (!other) return null;

                const isActive = conv._id === activeConvId;
                const hasUnread = conv.unread > 0;
                const lastMsg = conv.last_message?.content || "No messages yet";
                const lastTime = conv.last_message?.timestamp
                    ? formatTime(conv.last_message.timestamp)
                    : "";

                const isRequest = conv.type === 'request' && conv.request_status === 'pending';

                return (
                    <button
                        key={conv._id}
                        className={`conv-item ${isActive ? 'conv-item--active' : ''} ${hasUnread ? 'conv-item--unread' : ''}`}
                        onClick={() => onSelect(conv)}
                    >
                        <div className="conv-item__avatar">
                            <Avatar
                                src={other.personal_info?.profile_img}
                                alt={other.personal_info?.fullname}
                                size={44}
                            />
                        </div>
                        <div className="conv-item__body">
                            <div className="conv-item__top">
                                <span className="conv-item__name">
                                    {other.personal_info?.fullname}
                                    {isRequest && <span className="conv-item__request-badge">Request</span>}
                                </span>
                                <span className="conv-item__time">{lastTime}</span>
                            </div>
                            <p className="conv-item__preview">
                                {lastMsg}
                            </p>
                        </div>
                        {hasUnread && (
                            <span className="conv-item__unread-badge">{conv.unread}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // Less than 24 hours → show time
    if (diff < 86400000) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // Less than 7 days → show day name
    if (diff < 604800000) {
        return date.toLocaleDateString([], { weekday: 'short' });
    }
    // Older → show date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default ConversationList;
