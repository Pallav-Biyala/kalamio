import { useState, useRef, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { UserContext } from "../App";
import toast from "react-hot-toast";
import api from "../common/api";
import { useSubscribeStatus } from "../hooks/queries";
import { useSubscribeAction } from "../hooks/mutations";

const PublicationMenu = ({ publicationId, ownerId, ownerUsername, isOwner, onSubscribeChange }) => {
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);
    const navigate = useNavigate();
    const { userAuth: { access_token } } = useContext(UserContext);

    // Subscription state is shared with SubscribeButton via the TanStack cache,
    // so both controls always read/write the same source of truth.
    const { data: subscribeStatus } = useSubscribeStatus(publicationId);
    const subscribeMutation = useSubscribeAction();
    const isSubscribed = !!subscribeStatus;

    const [isFollowing, setIsFollowing] = useState(false);
    const [loadingFollow, setLoadingFollow] = useState(false);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handleKey = (e) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [open]);

    // Fetch initial follow state if not owner (subscription state comes from the shared query)
    useEffect(() => {
        if (!access_token || isOwner) return;

        api.post("/is-following", { user_id: ownerId })
            .then(({ data }) => setIsFollowing(data.following))
            .catch(() => setIsFollowing(false));

    }, [access_token, ownerId, isOwner]);

    const copyLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url)
            .then(() => toast.success("Link copied"))
            .catch(() => toast.error("Failed to copy"));
        setOpen(false);
    };

    const handleEdit = () => {
        setOpen(false);
        navigate(`/dashboard/edit-publication/${window.location.pathname.split("/").pop()}`);
    };

    const handleSubscribeToggle = () => {
        if (!access_token) {
            toast.error("Please sign in to subscribe");
            setOpen(false);
            return;
        }

        if (subscribeMutation.isPending) return;

        const newState = !isSubscribed;

        subscribeMutation.mutate(
            { publicationId, action: newState ? "subscribe" : "unsubscribe" },
            {
                // Same single delta the SubscribeButton reports, so the header
                // subscriber count is never adjusted twice for one action.
                onSuccess: () => onSubscribeChange?.(newState),
                onError: () => toast.error(newState ? "Failed to subscribe" : "Failed to unsubscribe")
            }
        );

        setOpen(false);
    };

    const handleFollowToggle = async () => {
        if (!access_token) {
            toast.error("Please sign in to follow");
            setOpen(false);
            return;
        }

        if (loadingFollow) return;
        setLoadingFollow(true);

        const newState = !isFollowing;
        setIsFollowing(newState);

        try {
            const endpoint = newState ? "/follow" : "/unfollow";
            await api.post(endpoint, { user_id: ownerId });
            toast.success(newState ? `Followed @${ownerUsername}` : `Unfollowed @${ownerUsername}`);
        } catch (err) {
            setIsFollowing(!newState);
        } finally {
            setLoadingFollow(false);
        }
    };

    return (
        <div className="post-menu relative z-20" ref={menuRef}>
            <button
                className="w-10 h-10 rounded-full flex items-center justify-center bg-grey/50 hover:bg-grey transition-colors"
                aria-label="More options"
                onClick={() => setOpen(!open)}
            >
                <Icon name="more_horiz" />
            </button>

            {open && (
                <div className="post-menu__dropdown mt-2 right-0 left-auto origin-top-right">
                    <button className="post-menu__item" onClick={copyLink}>
                        <Icon name="link" />
                        <span>Copy link</span>
                    </button>

                    {isOwner ? (
                        <>
                            <button className="post-menu__item" onClick={handleEdit}>
                                <Icon name="edit" />
                                <span>Edit</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="post-menu__item" onClick={handleSubscribeToggle} disabled={subscribeMutation.isPending}>
                                <Icon name={isSubscribed ? "notifications_active" : "notifications"} />
                                <span>{isSubscribed ? "Unsubscribe" : "Subscribe"}</span>
                            </button>
                            <button className="post-menu__item" onClick={handleFollowToggle} disabled={loadingFollow}>
                                <Icon name={isFollowing ? "person_remove" : "person_add"} />
                                <span>{isFollowing ? "Unfollow publisher" : "Follow publisher"}</span>
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default PublicationMenu;
