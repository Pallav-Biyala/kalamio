const MessageBubble = ({ message, isOwn, showAvatar = true }) => {
    const { content, sentAt, sender } = message;

    const time = new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className={`msg-bubble ${isOwn ? 'msg-bubble--own' : 'msg-bubble--other'}`}>
            {!isOwn && showAvatar && (
                <img
                    src={sender?.personal_info?.profile_img}
                    alt=""
                    className="msg-bubble__avatar"
                />
            )}
            <div className="msg-bubble__body">
                <p className="msg-bubble__text">{content}</p>
                <span className="msg-bubble__time">{time}</span>
            </div>
        </div>
    );
};

export default MessageBubble;
