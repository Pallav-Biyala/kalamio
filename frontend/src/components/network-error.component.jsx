import Icon from "./Icon";

/**
 * NetworkError — shown when a fetch fails due to no internet / server error.
 * @param {function} onRetry  - Optional callback to retry the fetch.
 * @param {string}   message  - Optional custom message.
 */
const NetworkError = ({ onRetry, message }) => {
    const isOffline = !navigator.onLine;
    const title = isOffline ? "You're offline" : "Something went wrong";
    const subtitle = message || (isOffline
        ? "Check your internet connection and try again."
        : "We couldn't load this content. Please try again.");

    return (
        <div className="network-error">
            <div className="network-error__icon-wrap">
                <Icon name={isOffline ? "wifi_off" : "cloud_off"} className="network-error__icon" />
            </div>
            <h3 className="network-error__title">{title}</h3>
            <p className="network-error__subtitle">{subtitle}</p>
            {onRetry && (
                <button className="network-error__retry" onClick={onRetry}>
                    <Icon name="refresh" className="text-base" />
                    Try again
                </button>
            )}
        </div>
    );
};

export default NetworkError;
