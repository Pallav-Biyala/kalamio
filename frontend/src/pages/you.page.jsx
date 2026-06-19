import { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import usePageTitle from "../common/usePageTitle";
import { UserContext } from "../App";
import { ThemeContext } from "../App";
import { removeFromSession, storeInSession } from "../common/session";
import AnimationWrapper from "../common/page-animation";
import Icon from "../components/Icon";
import Avatar from "../components/Avatar";

const MenuLink = ({ to, icon, label, badge, onClick }) => {
    const content = (
        <>
            <Icon name={icon} className="text-[22px] text-dark-grey" />
            <span className="flex-1">{label}</span>
            {badge && <span className="you-hub__badge">{badge}</span>}
            <Icon name="chevron_right" className="text-[20px] text-dark-grey/50" />
        </>
    );

    if (onClick) {
        return (
            <button className="you-hub__item" onClick={onClick}>
                {content}
            </button>
        );
    }

    return (
        <Link to={to} className="you-hub__item">
            {content}
        </Link>
    );
};

const YouPage = () => {

    usePageTitle('You');

    const { userAuth: { access_token, username, fullname, profile_img, new_notification_available }, setUserAuth } = useContext(UserContext);
    const { theme, setTheme } = useContext(ThemeContext);
    const navigate = useNavigate();

    if (!access_token) {
        navigate("/signin", { replace: true });
        return null;
    }

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

    return (
        <AnimationWrapper>
            <div className="you-hub">

                {/* Profile Card */}
                <Link to={`/user/${username}`} className="you-hub__profile-card">
                    <div className="you-hub__avatar">
                        <Avatar src={profile_img} alt={username} size={56} />
                    </div>
                    <div className="you-hub__profile-info">
                        <h2 className="you-hub__name">{fullname || username}</h2>
                        <p className="you-hub__username">@{username}</p>
                    </div>
                    <Icon name="chevron_right" className="text-[22px] text-dark-grey/50" />
                </Link>

                {/* Dashboard Section */}
                <div className="you-hub__section">
                    <h3 className="you-hub__section-header">Dashboard</h3>
                    <div className="you-hub__menu">
                        <MenuLink to="/dashboard/blogs" icon="article" label="My Blogs" />
                        <MenuLink to="/dashboard/drafts" icon="draft" label="Drafts" />
                        <MenuLink to="/dashboard/bookmarks" icon="bookmark" label="Bookmarks" />
                        <MenuLink
                            to="/dashboard/notifications"
                            icon="notifications"
                            label="Notifications"
                            badge={new_notification_available ? "New" : null}
                        />
                        <MenuLink to="/dashboard/connections" icon="handshake" label="Connections" />
                        <MenuLink to="/dashboard/publications" icon="import_contacts" label="Publications" />
                        <MenuLink to="/dashboard/analytics" icon="bar_chart" label="Analytics" />
                        <MenuLink to="/editor" icon="edit_note" label="Write" />
                    </div>
                </div>

                {/* Settings Section */}
                <div className="you-hub__section">
                    <h3 className="you-hub__section-header">Settings</h3>
                    <div className="you-hub__menu">
                        <MenuLink to="/settings/edit-profile" icon="person" label="Edit Profile" />
                        <MenuLink to="/settings/change-password" icon="lock" label="Change Password" />
                        <MenuLink to="/settings/notification-preferences" icon="notifications_active" label="Notification Prefs" />
                        <MenuLink to="/settings/blocked-users" icon="block" label="Blocked Users" />
                        <MenuLink
                            icon={theme === "light" ? "dark_mode" : "light_mode"}
                            label={theme === "light" ? "Dark Mode" : "Light Mode"}
                            onClick={changeTheme}
                        />
                    </div>
                </div>

                {/* Sign Out */}
                <div className="you-hub__section">
                    <button className="you-hub__signout" onClick={signOutUser}>
                        <Icon name="logout" className="text-[22px]" />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>
        </AnimationWrapper>
    );
};

export default YouPage;
