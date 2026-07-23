import { useContext, useEffect, useState } from "react";
import usePageTitle from "../common/usePageTitle";
import { UserContext } from "../App";
import api from "../common/api";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import Icon from "../components/Icon";
import toast from "react-hot-toast";

const MESSAGING_OPTIONS = [
    { value: 'everyone', label: 'Everyone', desc: 'Anyone can send you messages' },
    { value: 'nobody', label: 'Nobody', desc: 'Disable all incoming messages' },
];

const PROFILE_OPTIONS = [
    { value: 'everyone', label: 'Everyone', desc: 'Your profile is visible to anyone' },
    { value: 'logged_in', label: 'Logged In Users', desc: 'Only signed-in users can see your profile' },
];

const PrivacySettingsPage = () => {

    usePageTitle("Privacy");

    const { userAuth: { access_token } } = useContext(UserContext);
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!access_token) return;
        api.post("/settings/privacy")
        .then(({ data }) => {
            setSettings(data.privacy_settings);
            setLoading(false);
        })
        .catch(() => setLoading(false));
    }, [access_token]);

    const updateSetting = (key, value) => {
        const updated = { ...settings, [key]: value };
        setSettings(updated);
        setSaving(true);

        api.post("/settings/update-privacy", { privacy_settings: updated })
        .then(() => {
            setSaving(false);
            toast.success("Privacy settings updated");
        })
        .catch(() => {
            setSaving(false);
            toast.error("Failed to update");
        });
    };

    if (loading) return <Loader />;

    return (
        <AnimationWrapper>
            <div>
                <h1 className="max-md:hidden">Privacy</h1>
                <p className="text-dark-grey text-sm mt-2 mb-8 max-md:mt-2">
                    Control who can see your profile and send you messages.
                    {saving && <span className="text-xs ml-2 text-dark-grey/60">Saving...</span>}
                </p>

                {/* Who Can Message Me */}
                <div className="privacy__section">
                    <div className="privacy__section-header">
                        <Icon name="chat" className="text-xl" style={{ color: 'rgb(var(--c-brand-accent))' }} />
                        <h2>Who Can Message Me</h2>
                    </div>
                    <div className="privacy__options">
                        {MESSAGING_OPTIONS.map(({ value, label, desc }) => (
                            <label key={value} className={`privacy__option ${settings?.who_can_message === value ? 'privacy__option--active' : ''}`}>
                                {/* sr-only, not `hidden`: keeps the input focusable and in the
                                    accessibility tree while the custom radio below draws the visuals. */}
                                <input
                                    type="radio"
                                    name="who_can_message"
                                    value={value}
                                    checked={settings?.who_can_message === value}
                                    onChange={() => updateSetting('who_can_message', value)}
                                    className="sr-only"
                                />
                                <div className="privacy__option-radio">
                                    {settings?.who_can_message === value && <div className="privacy__option-radio-dot" />}
                                </div>
                                <div>
                                    <span className="font-medium text-sm">{label}</span>
                                    <span className="text-xs text-dark-grey block">{desc}</span>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Profile Visibility */}
                <div className="privacy__section">
                    <div className="privacy__section-header">
                        <Icon name="visibility" className="text-xl" style={{ color: 'rgb(var(--c-brand-accent))' }} />
                        <h2>Profile Visibility</h2>
                    </div>
                    <div className="privacy__options">
                        {PROFILE_OPTIONS.map(({ value, label, desc }) => (
                            <label key={value} className={`privacy__option ${settings?.show_profile === value ? 'privacy__option--active' : ''}`}>
                                <input
                                    type="radio"
                                    name="show_profile"
                                    value={value}
                                    checked={settings?.show_profile === value}
                                    onChange={() => updateSetting('show_profile', value)}
                                    className="sr-only"
                                />
                                <div className="privacy__option-radio">
                                    {settings?.show_profile === value && <div className="privacy__option-radio-dot" />}
                                </div>
                                <div>
                                    <span className="font-medium text-sm">{label}</span>
                                    <span className="text-xs text-dark-grey block">{desc}</span>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Toggle Options */}
                <div className="privacy__section">
                    <div className="privacy__section-header">
                        <Icon name="tune" className="text-xl" style={{ color: 'rgb(var(--c-brand-accent))' }} />
                        <h2>Display Preferences</h2>
                    </div>

                    <div className="privacy__toggle-row">
                        <div>
                            <span className="font-medium text-sm">Show Read Count</span>
                            <span className="text-xs text-dark-grey block">Display total reads on your profile</span>
                        </div>
                        <label className="custom-toggle">
                            <input
                                type="checkbox"
                                checked={settings?.show_read_count ?? true}
                                onChange={(e) => updateSetting('show_read_count', e.target.checked)}
                            />
                            <span className="custom-toggle__slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        </AnimationWrapper>
    );
};

export default PrivacySettingsPage;
