import { useContext, useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ThemeContext, UserContext } from "../App";
import lightLogo from "../imgs/logo-light.png";
import darkLogo from "../imgs/logo-dark.png";
import Icon from "./Icon";
import { useNewNotification } from "../hooks/queries";

const MobileTopBar = () => {

    const { userAuth: { access_token } } = useContext(UserContext);
    // Read the badge from the query, not a context flag: the query is the authoritative value
    // (server-backed, socket-invalidated, 60s poll), so it also CLEARS when a notification is
    // removed — e.g. someone revoking a like.
    const { data: notificationData } = useNewNotification();
    const new_notification_available = notificationData?.new_notification_available;
    const { theme } = useContext(ThemeContext);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();
    const location = useLocation();
    
    // Check if we are inside a section of the "You" hub (dashboard or settings)
    const isSubPage = location.pathname.startsWith("/dashboard") || location.pathname.startsWith("/settings");

    // Get the title for the current sub-page
    const getPageTitle = () => {
        const path = location.pathname;
        if (path.includes("/dashboard/blogs")) return "My Blogs";
        if (path.includes("/dashboard/drafts")) return "Drafts";
        if (path.includes("/dashboard/bookmarks")) return "Collections";
        if (path.includes("/dashboard/notifications")) return "Activity";

        if (path.includes("/dashboard/publications")) return "Publications";
        if (path.includes("/dashboard/analytics")) return "Analytics";
        
        if (path.includes("/settings/profile")) return "Profile";
        if (path.includes("/settings/edit-profile")) return "Edit Profile";
        if (path.includes("/settings/change-password")) return "Change Password";
        if (path.includes("/settings/notification-preferences")) return "Notifications";
        if (path.includes("/settings/blocked-users")) return "Blocked Users";
        if (path.includes("/settings/privacy")) return "Privacy";
        if (path.includes("/settings/account")) return "Account";
        
        return "Back";
    };

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
                    {/* Left: Logo + Brand name OR Back button */}
                    {isSubPage ? (
                        <button onClick={() => navigate(-1)} className="flex items-center gap-1 -ml-1 py-1 pr-3 rounded-full hover:bg-grey transition-colors text-black">
                            <Icon name="arrow_back" className="text-[22px]" />
                            <span className="font-semibold text-[15px]">{getPageTitle()}</span>
                        </button>
                    ) : (
                        <Link to="/" state={{ resetScroll: true }} className="mobile-top-bar__brand flex items-center">
                            <img
                                src={theme === "light" ? darkLogo : lightLogo}
                                alt="Kalamio logo"
                                className="mobile-top-bar__brand-icon"
                            />
                            <span className="mobile-top-bar__brand-name">Kalamio</span>
                            <span className="bg-[#FF6B00]/10 text-[#FF6B00] text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 border border-[#FF6B00]/20 leading-none">BETA</span>
                        </Link>
                    )}

                    {/* Right: Notification + Search (Hidden on sub-pages) */}
                    {!isSubPage && (
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
                    )}
                </>
            )}
        </header>
    );
};

export default MobileTopBar;
