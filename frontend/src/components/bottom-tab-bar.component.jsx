import { useContext, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../App";
import Icon from "./Icon";
import Avatar from "./Avatar";
import TextPostComposer from "./text-post-composer.component";

const BottomTabBar = () => {

    const { userAuth: { access_token, profile_img } } = useContext(UserContext);
    const navigate = useNavigate();
    const location = useLocation();

    const [showFabMenu, setShowFabMenu] = useState(false);
    const [showComposer, setShowComposer] = useState(false);

    const handleCreateTextPost = () => {
        setShowFabMenu(false);
        setShowComposer(true);
    };

    const handleCreateArticle = () => {
        setShowFabMenu(false);
        navigate(access_token ? "/editor" : "/signin");
    };

    const handleFabClick = () => {
        if (!access_token) {
            navigate("/signin");
            return;
        }
        setShowFabMenu(prev => !prev);
    };

    return (
        <>
        <nav className="bottom-tab-bar">
            <NavLink to="/" end className={({ isActive }) => "bottom-tab-bar__item" + (isActive ? " active" : "")}>
                {({ isActive }) => (
                    <>
                        <Icon name="home" className="text-2xl" filled={isActive} />
                        <span>Home</span>
                    </>
                )}
            </NavLink>

            <NavLink to="/reads" className={({ isActive }) => "bottom-tab-bar__item" + (isActive ? " active" : "")}>
                {({ isActive }) => (
                    <>
                        <Icon name="auto_stories" className="text-2xl" filled={isActive} />
                        <span>Articles</span>
                    </>
                )}
            </NavLink>

            {access_token ? (
                <NavLink to="/messages" className={({ isActive }) => "bottom-tab-bar__item" + (isActive ? " active" : "")}>
                    {({ isActive }) => (
                        <>
                            <Icon name="chat_bubble_outline" className="text-2xl" filled={isActive} />
                            <span>Chat</span>
                        </>
                    )}
                </NavLink>
            ) : (
                <NavLink to="/signin" className={({ isActive }) => "bottom-tab-bar__item" + (isActive ? " active" : "")}>
                    {({ isActive }) => (
                        <>
                            <Icon name="chat_bubble_outline" className="text-2xl" filled={isActive} />
                            <span>Chat</span>
                        </>
                    )}
                </NavLink>
            )}

            <NavLink to={access_token ? "/subscriptions" : "/signin"} className={({ isActive }) => "bottom-tab-bar__item" + (isActive ? " active" : "")}>
                {({ isActive }) => (
                    <>
                        <Icon name="subscriptions" className="text-2xl" filled={isActive} />
                        <span>Subs</span>
                    </>
                )}
            </NavLink>

            {access_token ? (
                <NavLink to="/settings/edit-profile" className={({ isActive }) => "bottom-tab-bar__item" + (isActive ? " active" : "")}>
                    {({ isActive }) => (
                        <>
                            {profile_img ? (
                                <Avatar src={profile_img} size={24} />
                            ) : (
                                <Icon name="person" className="text-2xl" filled={isActive} />
                            )}
                            <span>You</span>
                        </>
                    )}
                </NavLink>
            ) : (
                <NavLink to="/signin" className={({ isActive }) => "bottom-tab-bar__item" + (isActive ? " active" : "")}>
                    {({ isActive }) => (
                        <>
                            <Icon name="person" className="text-2xl" filled={isActive} />
                            <span>You</span>
                        </>
                    )}
                </NavLink>
            )}
        </nav>

        {/* Floating Action Button (FAB) — bottom right, only on Home */}
        {access_token && location.pathname === "/" && (
            <div className="fab-container">
                {showFabMenu && (
                    <>
                        <div className="fab-backdrop" onClick={() => setShowFabMenu(false)} />
                        <div className="fab-menu">
                            <button className="fab-menu__item" onClick={handleCreateTextPost}>
                                <span className="fab-menu__label">Post</span>
                                <span className="fab-menu__icon">
                                    <Icon name="edit_note" className="text-xl" />
                                </span>
                            </button>
                            <button className="fab-menu__item" onClick={handleCreateArticle}>
                                <span className="fab-menu__label">Article</span>
                                <span className="fab-menu__icon">
                                    <Icon name="article" className="text-xl" />
                                </span>
                            </button>
                        </div>
                    </>
                )}
                <button
                    className={`fab-button ${showFabMenu ? "fab-button--active" : ""}`}
                    onClick={handleFabClick}
                    aria-label="Create"
                >
                    <Icon name={showFabMenu ? "close" : "add"} className="text-3xl" />
                </button>
            </div>
        )}

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

export default BottomTabBar;
