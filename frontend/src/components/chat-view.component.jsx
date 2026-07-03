import { useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { UserContext } from "../App";
import api from "../common/api";
import { getSocket } from "../common/socket";
import MessageBubble from "./message-bubble.component";
import Avatar from "./Avatar";
import Icon from "./Icon";
import toast from "react-hot-toast";

const ChatView = ({ conversation, onConversationUpdate, onConversationCreated }) => {

    const { userAuth: { _id: currentUserId, access_token } } = useContext(UserContext);

    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [isTyping, setIsTyping] = useState(false);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    const other = conversation?.other_user;
    const convId = conversation?._id;
    const isNewConv = conversation?._isNew;
    const recipientId = conversation?._recipientId;
    const isRequest = conversation?.type === 'request' && conversation?.request_status === 'pending';
    // Reliably determine if I'm the recipient or sender of this request
    const isRequestSender = isRequest && conversation?.request_initiator?.toString() === currentUserId;
    const isRequestRecipient = isRequest && !isRequestSender;

    // Load messages
    useEffect(() => {
        if (isNewConv) {
            // New conversation — no messages to load
            setMessages([]);
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 200);
            return;
        }

        if (!convId) return;

        setMessages([]);
        setPage(1);
        setLoading(true);

        api.post("/messages", { conversation_id: convId, page: 1 })
        .then(({ data }) => {
            setMessages(data.messages);
            setHasMore(data.messages.length < data.totalDocs);
            setLoading(false);

            // Mark as read
            api.post("/messages/mark-read", { conversation_id: convId }).catch(() => {});
        })
        .catch(() => setLoading(false));

        // Focus input
        setTimeout(() => inputRef.current?.focus(), 200);
    }, [convId, isNewConv]);

    // Socket.IO real-time messages
    useEffect(() => {
        if (!access_token || !convId) return;

        const socket = getSocket();
        if (!socket) return;

        const handleNewMessage = (data) => {
            if (data.conversation_id === convId) {
                setMessages(prev => [...prev, data.message]);
                scrollToBottom();

                // Mark as read immediately since we're in this chat
                api.post("/messages/mark-read", { conversation_id: convId }).catch(() => {});
            }
            // Update conversation list regardless
            onConversationUpdate?.();
        };

        const handleTyping = (data) => {
            if (data.conversation_id === convId) {
                setIsTyping(true);
            }
        };

        const handleStopTyping = (data) => {
            if (data.conversation_id === convId) {
                setIsTyping(false);
            }
        };

        socket.on('new_message', handleNewMessage);
        socket.on('user_typing', handleTyping);
        socket.on('user_stop_typing', handleStopTyping);

        return () => {
            socket.off('new_message', handleNewMessage);
            socket.off('user_typing', handleTyping);
            socket.off('user_stop_typing', handleStopTyping);
        };
    }, [convId, access_token]);

    // Auto-scroll to bottom on new messages
    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
    };

    useEffect(() => {
        if (messages.length) scrollToBottom();
    }, [messages.length]);

    // Load more (older messages)
    const loadMore = () => {
        const nextPage = page + 1;
        api.post("/messages", { conversation_id: convId, page: nextPage })
        .then(({ data }) => {
            setMessages(prev => [...data.messages, ...prev]);
            setPage(nextPage);
            setHasMore(data.messages.length === 30);
        })
        .catch(() => {});
    };

    // Send message
    const handleSend = async () => {
        if (!newMessage.trim() || sending) return;

        setSending(true);
        const content = newMessage.trim();
        setNewMessage("");

        try {
            // For new conversations, send with recipient_id instead of conversation_id
            const payload = isNewConv
                ? { recipient_id: recipientId, content }
                : { conversation_id: convId, content };

            const { data } = await api.post("/message/send", payload);

            setMessages(prev => [...prev, data.message]);
            scrollToBottom();

            // If this was a new conversation, notify parent with the real conversation ID
            if (isNewConv && data.conversation_id) {
                onConversationCreated?.(data.conversation_id);
            }

            onConversationUpdate?.();

            // Stop typing indicator
            const socket = getSocket();
            if (socket && convId) {
                socket.emit('stop_typing', {
                    conversation_id: convId,
                    recipient_id: other._id
                });
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to send");
            setNewMessage(content); // Restore message
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Typing indicator
    const handleTyping = () => {
        const socket = getSocket();
        if (!socket || !other) return;

        socket.emit('typing', {
            conversation_id: convId,
            recipient_id: other._id
        });

        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('stop_typing', {
                conversation_id: convId,
                recipient_id: other._id
            });
        }, 2000);
    };

    // Accept / Decline message request
    const handleAcceptRequest = async () => {
        try {
            await api.post("/message-request/accept", { conversation_id: convId });
            toast.success("Request accepted");
            onConversationUpdate?.();
        } catch (err) {
            toast.error("Failed to accept request");
        }
    };

    const handleDeclineRequest = async () => {
        try {
            await api.post("/message-request/decline", { conversation_id: convId });
            toast.success("Request declined");
            onConversationUpdate?.();
        } catch (err) {
            toast.error("Failed to decline request");
        }
    };

    // Empty state
    if (!conversation) {
        return (
            <div className="chat-empty">
                <Icon name="chat" className="chat-empty__icon" />
                <h3>Select a conversation</h3>
                <p>Choose a conversation from the sidebar or start a new one from a profile.</p>
            </div>
        );
    }

    return (
        <div className="chat-view">
            {/* Header */}
            <div className="chat-header">
                <Link to={`/user/${other?.personal_info?.username}`} className="chat-header__user">
                    <Avatar
                        src={other?.personal_info?.profile_img}
                        alt={other?.personal_info?.fullname}
                        size={36}
                    />
                    <div className="chat-header__info">
                        <span className="chat-header__name">{other?.personal_info?.fullname}</span>
                        <span className="chat-header__username">@{other?.personal_info?.username}</span>
                    </div>
                </Link>
                {isRequest && (
                    <span className="chat-header__request-tag">Message Request</span>
                )}
            </div>

            {/* Messages area */}
            <div className="chat-messages">
                {hasMore && (
                    <button className="chat-load-more" onClick={loadMore}>
                        Load older messages
                    </button>
                )}

                {loading ? (
                    <div className="chat-loading">Loading messages...</div>
                ) : messages.length === 0 ? (
                    <div className="chat-start">
                        <Avatar
                            src={other?.personal_info?.profile_img}
                            alt=""
                            size={56}
                        />
                        <p>Start of your conversation with <strong>{other?.personal_info?.fullname}</strong></p>
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const isOwn = msg.sender?._id === currentUserId || msg.sender === currentUserId;
                        const showAvatar = i === 0 || messages[i-1]?.sender?._id !== msg.sender?._id;
                        return (
                            <MessageBubble
                                key={msg._id || i}
                                message={msg}
                                isOwn={isOwn}
                                showAvatar={showAvatar}
                            />
                        );
                    })
                )}

                {isTyping && (
                    <div className="chat-typing">
                        <span className="chat-typing__dots">
                            <span></span><span></span><span></span>
                        </span>
                        <span>{other?.personal_info?.fullname} is typing...</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Request Accept/Decline bar — only shown to recipient */}
            {isRequestRecipient && (
                <div className="chat-request-bar">
                    <p><strong>{other?.personal_info?.fullname}</strong> wants to message you</p>
                    <div className="chat-request-bar__actions">
                        <button className="chat-request-bar__accept" onClick={handleAcceptRequest}>
                            <Icon name="check" className="text-sm" /> Accept
                        </button>
                        <button className="chat-request-bar__decline" onClick={handleDeclineRequest}>
                            <Icon name="close" className="text-sm" /> Decline
                        </button>
                    </div>
                </div>
            )}

            {/* Sender waiting notice */}
            {isRequestSender && (
                <div className="chat-request-bar" style={{ justifyContent: 'center', textAlign: 'center' }}>
                    <p style={{ margin: 0, color: 'rgb(var(--c-dark-grey))' }}>
                        <Icon name="schedule" className="text-sm" style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                        Waiting for <strong>{other?.personal_info?.fullname}</strong> to accept your request
                    </p>
                </div>
            )}

            {/* Input area — hidden if request is pending (for both sender and recipient) */}
            {(isNewConv || (!isRequest)) && (
                <div className="chat-input">
                    <textarea
                        ref={inputRef}
                        className="chat-input__field"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => {
                            setNewMessage(e.target.value);
                            handleTyping();
                        }}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        maxLength={5000}
                    />
                    <button
                        className="chat-input__send"
                        onClick={handleSend}
                        disabled={!newMessage.trim() || sending}
                        aria-label="Send message"
                    >
                        <Icon name="send" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default ChatView;
