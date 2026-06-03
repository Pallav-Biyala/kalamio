import { useContext, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ThemeContext, UserContext } from "../App";
import lightLogo from "../imgs/logo-light.png";
import darkLogo from "../imgs/logo-dark.png";
import Icon from "./Icon";

const MobileTopBar = () => {

    const { userAuth: { access_token, new_notification_available } } = useContext(UserContext);
    const { theme } = useContext(ThemeContext);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();

    // Listen for search-open event from bottom tab bar
    useEffect(() => {
        const handler = () => setSearchOpen(true);
        window.addEventListener("open-mobile-search", handler);
        return () => window.removeEventListener("open-mobile-search", handler);
    }, []);

    const handleSearchKeyDown = (e) => {
        if (e.keyCode === 13 && searchQuery.length) {
            navigate(`/search/${searchQuery}`);
            setSearchOpen(false);
            setSearchQuery("");
        }
    };

    const handleSearchClick = () => {
        if (searchQuery.length) {
            navigate(`/search/${searchQuery}`);
            setSearchOpen(false);
            setSearchQuery("");
        }
    };

    return (
        <header className="mobile-top-bar">
            {searchOpen ? (
                <div className="mobile-top-bar__search">
                    <Icon name="search" className="text-xl text-dark-grey" />
                    <input
                        type="text"
                        placeholder="Search"
                        className="mobile-top-bar__search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        autoFocus
                    />
                    {searchQuery.length > 0 && (
                        <div className="flex items-center gap-1">
                            <button onClick={() => setSearchQuery("")} className="text-dark-grey hover:text-black flex items-center justify-center p-1 transition-colors">
                                <Icon name="close" className="text-lg" />
                            </button>
                            <div className="w-[1px] h-5 bg-border mx-1"></div>
                            <button onClick={handleSearchClick} className="text-black hover:opacity-80 flex items-center justify-center p-1 transition-colors">
                                <Icon name="search" className="text-lg" />
                            </button>
                        </div>
                    )}
                    {!searchQuery.length && (
                        <button onClick={() => setSearchOpen(false)} className="p-1 text-dark-grey hover:text-black">
                            <Icon name="close" className="text-xl" />
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* Left: Logo + Brand name */}
                    <Link to="/" className="mobile-top-bar__brand">
                        <img
                            src={theme === "light" ? darkLogo : lightLogo}
                            alt="Kalamio logo"
                            className="mobile-top-bar__brand-icon"
                        />
                        <span className="mobile-top-bar__brand-name">Kalamio</span>
                    </Link>

                    {/* Right: Notification + Search */}
                    <div className="mobile-top-bar__actions">
                        <Link
                            to={access_token ? "/dashboard/notifications" : "/signin"}
                            className="mobile-top-bar__icon-btn relative"
                        >
                            <Icon name="notifications" className="text-2xl" />
                            {access_token && new_notification_available && (
                                <span className="notification-badge !w-2 !h-2"></span>
                            )}
                        </Link>
                        <button
                            className="mobile-top-bar__icon-btn"
                            onClick={() => setSearchOpen(true)}
                        >
                            <Icon name="search" className="text-2xl" />
                        </button>
                    </div>
                </>
            )}
        </header>
    );
};

export default MobileTopBar;
