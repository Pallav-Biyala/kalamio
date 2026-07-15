import Avatar from "./Avatar";

const MessageBubble = ({ message, isOwn, showAvatar = true, showReceipt = false, myAvatar, myName }) => {
    const { content, sentAt, sender, read } = message;

    const time = new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Own messages show the current user's avatar (from context — always current); others show the
    // sender's populated avatar.
    const avatarSrc = isOwn ? myAvatar : sender?.personal_info?.profile_img;
    const avatarAlt = isOwn ? myName : sender?.personal_info?.fullname;

    return (
        <div className={`msg-bubble ${isOwn ? 'msg-bubble--own' : 'msg-bubble--other'} ${showAvatar ? 'msg-bubble--start' : ''}`}>
            {/* Reserve the avatar column on every row so consecutive bubbles stay aligned: the real
                avatar only on the first message of a group, an invisible spacer on the rest. */}
            {showAvatar ? (
                <Avatar src={avatarSrc} alt={avatarAlt} size={28} className="msg-bubble__avatar" />
            ) : (
                <span className="msg-bubble__avatar-spacer" aria-hidden="true" />
            )}
            <div className="msg-bubble__col">
                <div className="msg-bubble__body">
                    <p className="msg-bubble__text">{content}</p>
                    <span className="msg-bubble__time">{time}</span>
                </div>
                {/* Read receipt under own messages: "Delivered" until the other user opens the chat,
                    then "Read". Shown at status boundaries (last own message + read→delivered change). */}
                {isOwn && showReceipt && (
                    <span className="msg-bubble__receipt">{read ? "Read" : "Delivered"}</span>
                )}
            </div>
        </div>
    );
};

export default MessageBubble;
