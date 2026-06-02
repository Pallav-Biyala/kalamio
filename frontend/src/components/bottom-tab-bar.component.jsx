import { useContext } from "react";
import { NavLink, Link } from "react-router-dom";
import { UserContext } from "../App";
import Icon from "./Icon";
import Avatar from "./Avatar";

const BottomTabBar = () => {

    const { userAuth: { access_token, profile_img } } = useContext(UserContext);

    return (
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
                        <span>Reads</span>
                    </>
                )}
            </NavLink>

            <Link to={access_token ? "/editor" : "/signin"} className="bottom-tab-bar__create">
                <Icon name="add" className="text-2xl" />
            </Link>

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
    );
};

export default BottomTabBar;
