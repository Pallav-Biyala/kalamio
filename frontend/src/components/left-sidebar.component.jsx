import { useContext, useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { ThemeContext, UserContext } from "../App";
import { storeInSession, removeFromSession } from "../common/session";
import lightLogo from "../imgs/logo-light.png";
import darkLogo from "../imgs/logo-dark.png";
import Icon from "./Icon";
import KeepReading from "./keep-reading.component";
import TextPostComposer from "./text-post-composer.component";
import Avatar from "./Avatar";

const navItems = [
    { to: "/", icon: "home", label: "Home", end: true },
    { to: "/reads", icon: "auto_stories", label: "Articles" },
    { to: "/search/", icon: "explore", label: "Explore" },
    { to: "/dashboard/notifications", icon: "notifications", label: "Activity", authOnly: true },
    { to: "/messages", icon: "chat_bubble_outline", label: "Chat", authOnly: true },
    { to: "/dashboard/blogs?tab=draft", icon: "draft", label: "Drafts", authOnly: true },
];

const LeftSidebar = () => {

    const { userAuth: { access_token, profile_img, username, fullname, new_notification_available }, setUserAuth } = useContext(UserContext);
    const { theme, setTheme } = useContext(ThemeContext);
    const navigate = useNavigate();

    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const [showComposer, setShowComposer] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    const signOutUser = () => {
        removeFromSession("user");
        setUserAuth({ access_token: null });
    };

    const changeTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        if (newTheme === "light") {
            document.documentElement.setAttribute("data-theme", "light");
        } else {
            document.documentElement.removeAttribute("data-theme");
        }
        setTheme(newTheme);
        storeInSession("theme", newTheme);
    };

    const handleCreateTextPost = () => {
        setShowCreateMenu(false);
        setShowComposer(true);
    };

    const handleCreateArticle = () => {
        setShowCreateMenu(false);
        navigate("/editor");
    };

    return (
        <>
        <aside className="left-sidebar">
            {/* Logo */}
            <Link to="/" className="left-sidebar__logo">
                <img
                    src={theme === "light" ? darkLogo : lightLogo}
                    alt="Kalamio logo"
                />
                <span className="left-sidebar__logo-text">Kalamio</span>
            </Link>

            {/* Navigation */}
            <nav className="left-sidebar__nav">
                {navItems.map(({ to, icon, label, end, authOnly }) => {
                    if (authOnly && !access_token) return null;

                    return (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                "left-sidebar__link" + (isActive ? " active" : "")
                            }
                        >
                            <div className="relative">
                                <Icon name={icon} className="text-[22px]" />
                                {icon === "notifications" && new_notification_available && (
                                    <span className="notification-badge !w-2 !h-2 !top-0 !right-0"></span>
                                )}
                            </div>
                            <span>{label}</span>
                        </NavLink>
                    );
                })}
            </nav>

            {/* Create Button with Dropdown */}
            {access_token ? (
                <div className="create-menu">
                    <button
                        className="left-sidebar__write-btn"
                        onClick={() => setShowCreateMenu(prev => !prev)}
                    >
                        <Icon name="add" className="text-xl" />
                        <span>Create</span>
                    </button>

                    {showCreateMenu && (
                        <>
                            <div className="create-menu__backdrop" onClick={() => setShowCreateMenu(false)} />
                            <div className="create-menu__dropdown">
                                <button className="create-menu__item" onClick={handleCreateTextPost}>
                                    <span className="create-menu__item-icon">
                                        <Icon name="edit_note" className="text-xl" />
                                    </span>
                                    <span className="create-menu__item-text">
                                        <span className="create-menu__item-label">Text Post</span>
                                        <span className="create-menu__item-desc">Share a quick thought</span>
                                    </span>
                                </button>
                                <button className="create-menu__item" onClick={handleCreateArticle}>
                                    <span className="create-menu__item-icon">
                                        <Icon name="article" className="text-xl" />
                                    </span>
                                    <span className="create-menu__item-text">
                                        <span className="create-menu__item-label">Write Article</span>
                                        <span className="create-menu__item-desc">Long-form blog post</span>
                                    </span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <Link to="/signin" className="left-sidebar__write-btn">
                    <span>Sign In</span>
                </Link>
            )}

            {/* Keep Reading */}
            <KeepReading />

            {/* Spacer */}
            <div className="flex-1" />

            {/* Footer + copyright (logged out only) */}
            {!access_token && (
                <div className="left-sidebar__footer">
                    <p className="left-sidebar__copyright">© 2026 Kalamio</p>
                    <div className="left-sidebar__footer-links">
                        <a href="#">About</a>
                        <a href="#">Help</a>
                        <a href="#">Terms</a>
                        <a href="#">Privacy</a>
                    </div>
                </div>
            )}

            {/* User Profile Menu */}
            <div className="left-sidebar__bottom">
                {!access_token && (
                    <button
                        className="left-sidebar__link"
                        onClick={changeTheme}
                        aria-label="Toggle theme"
                    >
                        <Icon name={theme === "light" ? "dark_mode" : "light_mode"} className="text-[22px]" />
                        <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
                    </button>
                )}

                {access_token && (
                    <div className="left-sidebar__profile-menu">
                        <button
                            className="left-sidebar__profile-trigger"
                            onClick={() => setShowProfileMenu(prev => !prev)}
                        >
                            <div className="relative shrink-0">
                                {profile_img ? (
                                    <Avatar src={profile_img} alt={username} size={32} className="border border-[rgb(var(--c-border))]" />
                                ) : (
                                    <Icon name="person" className="text-[24px]" />
                                )}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1 justify-center text-left gap-0">
                                <span className="font-semibold text-black text-[13px] leading-[1.2] truncate">
                                    {fullname || username}
                                </span>
                                <span className="text-dark-grey text-[11px] leading-[1.2] truncate">
                                    @{username}
                                </span>
                            </div>
                            <Icon name="unfold_more" className="text-dark-grey text-[16px] shrink-0" />
                        </button>

                        {showProfileMenu && (
                            <>
                                <div className="left-sidebar__profile-backdrop" onClick={() => setShowProfileMenu(false)} />
                                <div className="left-sidebar__profile-dropdown">
                                    <Link to="/settings/edit-profile" className="left-sidebar__profile-dropdown-item" onClick={() => setShowProfileMenu(false)}>
                                        <Icon name="settings" className="text-[20px]" />
                                        <span>Settings</span>
                                    </Link>
                                    <Link to="/dashboard/blogs" className="left-sidebar__profile-dropdown-item" onClick={() => setShowProfileMenu(false)}>
                                        <Icon name="dashboard" className="text-[20px]" />
                                        <span>Dashboard</span>
                                    </Link>
                                    <button className="left-sidebar__profile-dropdown-item" onClick={() => { changeTheme(); }}>
                                        <Icon name={theme === "light" ? "dark_mode" : "light_mode"} className="text-[20px]" />
                                        <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
                                    </button>
                                    <div className="left-sidebar__profile-dropdown-divider" />
                                    <button className="left-sidebar__profile-dropdown-item" onClick={() => { setShowProfileMenu(false); signOutUser(); }}>
                                        <Icon name="logout" className="text-[20px]" />
                                        <span>Log out</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </aside>

        {/* Text Post Composer Modal */}
        <TextPostComposer
            isOpen={showComposer}
            onClose={() => setShowComposer(false)}
            onPosted={() => {
                window.location.reload();
            }}
        />
        </>
    );
};

export default LeftSidebar;
