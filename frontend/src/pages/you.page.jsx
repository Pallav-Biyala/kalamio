import { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import usePageTitle from "../common/usePageTitle";
import { UserContext } from "../App";
import { ThemeContext } from "../App";
import { removeFromSession, storeInSession } from "../common/session";
import { revokeSessionOnServer } from "../common/api";
import AnimationWrapper from "../common/page-animation";
import Icon from "../components/Icon";
import Avatar from "../components/Avatar";

const MenuLink = ({ to, icon, label, badge, onClick }) => {
    const content = (
        <>
            <Icon name={icon} className="text-[26px] text-dark-grey" />
            <span className="flex-1">{label}</span>
            {badge && <span className="you-hub__badge">{badge}</span>}
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
        revokeSessionOnServer(); // best-effort: invalidate this device's refresh session server-side
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
                        <Avatar src={profile_img} alt={username} size={48} />
                    </div>
                    <div className="you-hub__profile-info">
                        <h2 className="you-hub__name">{fullname || username}</h2>
                        <p className="you-hub__username">@{username}</p>
                    </div>
                </Link>

                {/* Dashboard Section */}
                <div className="you-hub__section">
                    <h3 className="you-hub__section-header">Dashboard</h3>
                    <div className="you-hub__menu">
                        <MenuLink to="/dashboard/blogs" icon="article" label="My Blogs" />
                        <MenuLink to="/dashboard/drafts" icon="draft" label="Drafts" />
                        <MenuLink to="/dashboard/bookmarks" icon="collections_bookmark" label="Collections" />
                        <MenuLink
                            to="/dashboard/notifications"
                            icon="notifications"
                            label="Activity"
                            badge={new_notification_available ? "New" : null}
                        />
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
                        <MenuLink to="/settings/notification-preferences" icon="notifications_active" label="Notifications" />
                        <MenuLink to="/settings/blocked-users" icon="block" label="Blocked Users" />
                        <MenuLink to="/settings/privacy" icon="shield" label="Privacy" />
                        <MenuLink to="/settings/account" icon="manage_accounts" label="Account" />
                        <MenuLink
                            icon={theme === "light" ? "dark_mode" : "light_mode"}
                            label={theme === "light" ? "Dark Mode" : "Light Mode"}
                            onClick={changeTheme}
                        />
                        <MenuLink
                            icon="feedback"
                            label="Send Feedback"
                            onClick={() => window.open("https://www.candiq.app/feedback/907oynz-", "_blank", "noopener,noreferrer")}
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
