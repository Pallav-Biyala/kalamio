import { useContext, useEffect, useState } from "react";
import usePageTitle from "../common/usePageTitle";
import { UserContext } from "../App";
import api from "../common/api";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import toast from "react-hot-toast";
import Icon from "../components/Icon";

const DEFAULTS = {
    like:             { in_app: true,  email: false },
    comment:          { in_app: true,  email: true },
    reply:            { in_app: true,  email: true },
    follow:           { in_app: true,  email: false },
    connect_request:  { in_app: true,  email: true },
    subscribe:        { in_app: true,  email: false },
    mention:          { in_app: true,  email: true },
    mute_all: false
};

const LABELS = {
    like:             { label: "Likes",              desc: "When someone likes your post" },
    comment:          { label: "Comments",           desc: "When someone comments on your post" },
    reply:            { label: "Replies",             desc: "When someone replies to your comment" },
    follow:           { label: "New Followers",       desc: "When someone follows you" },
    connect_request:  { label: "Connection Requests", desc: "When someone sends a connect request" },
    subscribe:        { label: "Subscriptions",       desc: "When someone subscribes to your publication" },
    mention:          { label: "Mentions",            desc: "When someone mentions you in a post" },
};

const ToggleSwitch = ({ checked, onChange, disabled = false }) => {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`notif-pref__toggle ${checked ? "notif-pref__toggle--on" : ""} ${disabled ? "notif-pref__toggle--disabled" : ""}`}
        >
            <span className="notif-pref__toggle-knob" />
        </button>
    );
};

const NotificationPreferences = () => {

    usePageTitle('Notification Preferences');

    const { userAuth: { access_token } } = useContext(UserContext);
    const [prefs, setPrefs] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (access_token) {
            api.post("/settings/notification-preferences")
            .then(({ data }) => {
                setPrefs(data.notification_preferences || DEFAULTS);
                setLoading(false);
            })
            .catch(() => {
                setPrefs(DEFAULTS);
                setLoading(false);
            });
        }
    }, [access_token]);

    const updatePrefs = (newPrefs) => {
        setPrefs(newPrefs);
        setSaving(true);

        api.post("/settings/update-notification-preferences", {
            notification_preferences: newPrefs
        })
        .then(() => {
            setSaving(false);
        })
        .catch(() => {
            setSaving(false);
            toast.error("Failed to save preferences");
        });
    };

    const handleToggle = (type, channel, value) => {
        const newPrefs = {
            ...prefs,
            [type]: {
                ...prefs[type],
                [channel]: value
            }
        };
        updatePrefs(newPrefs);
    };

    const handleMuteAll = (value) => {
        updatePrefs({ ...prefs, mute_all: value });
    };

    if (loading) return <Loader />;

    const isMuted = prefs.mute_all;

    return (
        <AnimationWrapper>
            <div className="notif-pref">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="max-md:hidden">Notification Preferences</h1>
                    {saving && (
                        <span className="text-sm text-dark-grey flex items-center gap-1">
                            <Icon name="sync" className="text-[16px] animate-spin" />
                            Saving...
                        </span>
                    )}
                </div>

                <p className="text-dark-grey text-sm mb-8">
                    Choose how you want to be notified about activity on Kalamio.
                </p>

                {/* Mute All Master Toggle */}
                <div className="notif-pref__mute-all">
                    <div className="flex-1">
                        <h3 className="text-base font-semibold text-black">Mute All Notifications</h3>
                        <p className="text-sm text-dark-grey mt-0.5">Temporarily pause all notifications</p>
                    </div>
                    <ToggleSwitch checked={isMuted} onChange={handleMuteAll} />
                </div>

                {/* Per-type Preferences */}
                <div className="notif-pref__table">
                    {/* Header */}
                    <div className="notif-pref__table-header">
                        <span className="flex-1">Notification Type</span>
                        <span className="notif-pref__col-header">In-App</span>
                        <span className="notif-pref__col-header">Email</span>
                    </div>

                    {/* Rows */}
                    {Object.entries(LABELS).map(([type, { label, desc }]) => (
                        <div key={type} className={"notif-pref__row" + (isMuted ? " notif-pref__row--muted" : "")}>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-black">{label}</h4>
                                <p className="text-xs text-dark-grey mt-0.5 truncate">{desc}</p>
                            </div>
                            <div className="notif-pref__col-toggle">
                                <ToggleSwitch
                                    checked={prefs[type]?.in_app ?? true}
                                    onChange={(val) => handleToggle(type, "in_app", val)}
                                    disabled={isMuted}
                                />
                            </div>
                            <div className="notif-pref__col-toggle">
                                <ToggleSwitch
                                    checked={prefs[type]?.email ?? false}
                                    onChange={(val) => handleToggle(type, "email", val)}
                                    disabled={isMuted}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </AnimationWrapper>
    );
};

export default NotificationPreferences;
