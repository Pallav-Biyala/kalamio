import { useContext, useEffect, useState } from "react";
import usePageTitle from "../common/usePageTitle";
import { UserContext } from "../App";
import api from "../common/api";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import Icon from "../components/Icon";
import toast from "react-hot-toast";
import { removeFromSession } from "../common/session";

const AccountManagementPage = () => {

    usePageTitle("Account");

    const { userAuth: { access_token }, setUserAuth } = useContext(UserContext);
    const [status, setStatus] = useState(null);
    const [isGoogleAuth, setIsGoogleAuth] = useState(false);
    const [loading, setLoading] = useState(true);
    const [password, setPassword] = useState("");
    const [reason, setReason] = useState("");
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        if (!access_token) return;
        api.post("/settings/account-status")
        .then(({ data }) => {
            setStatus(data.account_status);
            setIsGoogleAuth(data.google_auth);
            setLoading(false);
        })
        .catch(() => setLoading(false));
    }, [access_token]);

    const handleDeactivate = () => {
        if (!window.confirm("Deactivate your account? Your profile will be hidden but your data will be preserved. You can reactivate anytime.")) return;

        api.post("/settings/deactivate-account")
        .then(() => {
            toast.success("Account deactivated");
            removeFromSession("user");
            setUserAuth({ access_token: null });
        })
        .catch(err => toast.error(err.response?.data?.error || "Failed to deactivate"));
    };

    const handleReactivate = () => {
        api.post("/settings/reactivate-account")
        .then(() => {
            toast.success("Account reactivated");
            setStatus({ ...status, status: 'active', deactivated_at: null, deletion_scheduled_at: null });
        })
        .catch(err => toast.error(err.response?.data?.error || "Failed to reactivate"));
    };

    const handleDelete = () => {
        if (!window.confirm("DELETE your account? This will schedule permanent deletion in 30 days. You can cancel by signing back in.")) return;

        const body = { reason };
        if (!isGoogleAuth) body.password = password;

        api.post("/settings/delete-account", body)
        .then(({ data }) => {
            toast.success(data.message);
            removeFromSession("user");
            setUserAuth({ access_token: null });
        })
        .catch(err => toast.error(err.response?.data?.error || "Failed to delete account"));
    };

    const handleExport = () => {
        setExporting(true);
        api.post("/settings/export-data", {}, { responseType: 'blob' })
        .then(({ data }) => {
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'kalamio-data-export.json');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success("Data exported");
            setExporting(false);
        })
        .catch(() => {
            toast.error("Export failed");
            setExporting(false);
        });
    };

    if (loading) return <Loader />;

    const currentStatus = status?.status || 'active';
    const isDeletionPending = currentStatus === 'deleted' && status?.deletion_scheduled_at;

    return (
        <AnimationWrapper>
            <div>
                <h1 className="max-md:hidden">Account</h1>

                {/* Current Status */}
                {currentStatus !== 'active' && (
                    <div className={`account-mgmt__status-banner ${currentStatus === 'deleted' ? 'account-mgmt__status-banner--danger' : 'account-mgmt__status-banner--warning'}`}>
                        <Icon name={currentStatus === 'deleted' ? 'warning' : 'pause_circle'} className="text-xl" />
                        <div>
                            <strong>{currentStatus === 'deleted' ? 'Account Scheduled for Deletion' : 'Account Deactivated'}</strong>
                            {isDeletionPending && (
                                <p className="text-sm mt-1">
                                    Permanent deletion on: {new Date(status.deletion_scheduled_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            )}
                            <button className="account-mgmt__reactivate-btn" onClick={handleReactivate}>
                                <Icon name="play_arrow" className="text-lg" />
                                Reactivate Account
                            </button>
                        </div>
                    </div>
                )}

                {/* Data Export */}
                <div className="account-mgmt__card">
                    <div className="account-mgmt__card-header">
                        <Icon name="download" className="text-xl" style={{ color: 'rgb(var(--c-brand-accent))' }} />
                        <h2>Download Your Data</h2>
                    </div>
                    <p className="text-sm text-dark-grey mb-4">
                        Export all your data including profile, posts, comments, bookmarks, and followers as a JSON file.
                    </p>
                    <button className="btn-light" onClick={handleExport} disabled={exporting}>
                        <Icon name="download" className="text-lg mr-1" />
                        {exporting ? "Exporting..." : "Export Data"}
                    </button>
                </div>

                {/* Deactivate */}
                {currentStatus === 'active' && (
                    <div className="account-mgmt__card account-mgmt__card--warning">
                        <div className="account-mgmt__card-header">
                            <Icon name="pause_circle" className="text-xl" style={{ color: 'rgb(var(--c-orange))' }} />
                            <h2>Deactivate Account</h2>
                        </div>
                        <p className="text-sm text-dark-grey mb-2">
                            Temporarily hide your profile from search and feeds. Your posts and data remain intact. You can reactivate at any time by logging back in.
                        </p>
                        <ul className="account-mgmt__list">
                            <li>Your profile becomes invisible to others</li>
                            <li>Your posts remain saved but hidden</li>
                            <li>You can reactivate by signing in again</li>
                        </ul>
                        <button className="account-mgmt__deactivate-btn" onClick={handleDeactivate}>
                            Deactivate Account
                        </button>
                    </div>
                )}

                {/* Delete */}
                {currentStatus === 'active' && (
                    <div className="account-mgmt__card account-mgmt__card--danger">
                        <div className="account-mgmt__card-header">
                            <Icon name="delete_forever" className="text-xl" style={{ color: 'rgb(var(--c-red))' }} />
                            <h2>Delete Account</h2>
                        </div>
                        <p className="text-sm text-dark-grey mb-2">
                            Permanently delete your account and all associated data. You'll have a 30-day grace period to change your mind.
                        </p>
                        <ul className="account-mgmt__list account-mgmt__list--danger">
                            <li>All posts, comments, and bookmarks will be removed</li>
                            <li>Your followers will be lost</li>
                            <li>This action becomes irreversible after 30 days</li>
                        </ul>

                        {!isGoogleAuth && (
                            <div className="mb-4">
                                <label className="text-sm font-medium text-dark-grey block mb-1">Confirm your password</label>
                                <input
                                    type="password"
                                    className="input-box !w-full"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="text-sm font-medium text-dark-grey block mb-1">Reason for leaving (optional)</label>
                            <textarea
                                className="input-box !w-full resize-none"
                                rows={2}
                                placeholder="We'd love to know why you're leaving..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>

                        <button
                            className="account-mgmt__delete-btn"
                            onClick={handleDelete}
                            disabled={!isGoogleAuth && !password}
                        >
                            <Icon name="delete_forever" className="text-lg" />
                            Delete My Account
                        </button>
                    </div>
                )}
            </div>
        </AnimationWrapper>
    );
};

export default AccountManagementPage;
