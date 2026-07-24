import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import Icon from "../Icon";
import Avatar from "../Avatar";
import { cdnUrl } from "../../common/cdn";
import { getRelativeTime } from "../../common/date";

/**
 * Presentational core of a Reads-feed reel: background, gradient scrims, read-time pill, author row,
 * title, expandable description and tags. The interactive like/save/share rail is NOT part of this —
 * the live feed passes its wired rail via `children` (rendered inside `.reel-card__inner`), and the
 * publish preview passes a static one. This is the single source of truth so the feed and the
 * publish preview render an identical reel and can never drift.
 *
 * `interactive` (feed = true) makes the author row and tags real links/navigation; the publish
 * preview passes `false` so nothing navigates away from the editor.
 */
const ReelCardVisual = ({ blog, interactive = true, children }) => {
    const navigate = useNavigate();
    const {
        title, des, banner, scroll_image, tags, publishedAt, readTime,
        author: { personal_info: { fullname, profile_img, username } = {} } = {},
    } = blog;

    const [showFullDes, setShowFullDes] = useState(false);
    const displayReadTime = readTime || 1;

    const authorInner = (
        <>
            <Avatar src={profile_img} alt={fullname} size={36} />
            <div className="reel-card__author-info">
                <span className="reel-card__author-name">{fullname || "You"}</span>
                <span className="reel-card__author-meta">
                    @{username || "you"} · {publishedAt ? getRelativeTime(publishedAt) : "just now"}
                </span>
            </div>
        </>
    );

    return (
        <div className="reel-card">
            <div className="reel-card__inner">
                {/* Background image — prefer the author's dedicated 9:16 scroll cover, fall back to banner. */}
                {(scroll_image || banner) && (
                    <div className="reel-card__bg">
                        <img src={cdnUrl(scroll_image || banner)} alt="" draggable="false" />
                    </div>
                )}

                <div className="reel-card__gradient-top" />
                <div className="reel-card__gradient-bottom" />

                <div className="reel-card__top">
                    <div className="reel-card__read-time">
                        <Icon name="schedule" className="reel-card__read-time-icon" />
                        {displayReadTime} min read
                    </div>
                </div>

                {/* Interactive action rail (feed) or static one (preview) is injected here. */}
                {children}

                <div className="reel-card__content">
                    {interactive && username ? (
                        <Link to={`/user/${username}`} className="reel-card__author">{authorInner}</Link>
                    ) : (
                        <div className="reel-card__author">{authorInner}</div>
                    )}

                    <h2 className="reel-card__title">{title || "Your article title"}</h2>

                    {des && (
                        <div className={`reel-card__des ${showFullDes ? "reel-card__des--expanded" : ""}`}>
                            <p>{des}</p>
                            {des.length > 100 && !showFullDes && (
                                <button className="reel-card__des-toggle" onClick={() => setShowFullDes(true)}>
                                    more
                                </button>
                            )}
                        </div>
                    )}

                    {tags && tags.length > 0 && (
                        <div className="reel-card__tags">
                            {tags.slice(0, 4).map((tag, i) => (
                                <span
                                    key={i}
                                    className="reel-card__tag"
                                    onClick={interactive ? () => navigate(`/search/${encodeURIComponent(tag)}`) : undefined}
                                    style={interactive ? undefined : { cursor: "default" }}
                                >
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReelCardVisual;
