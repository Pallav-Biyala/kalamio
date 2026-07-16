// The autosave indicator in the editor header. Reflects the LOCAL autosave state (Phase A):
// a rotating icon while saving, a soft green dot once saved (with a relative timestamp).
// aria-live so screen readers announce the change without stealing focus.
import { useEffect, useState } from 'react';
import Icon from '../Icon';

const relTime = (ts) => {
    if (!ts) return '';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
};

const SaveStatus = ({ status, savedAt }) => {
    // Re-render periodically so the "Saved · Xs ago" label stays current.
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!savedAt) return;
        const id = setInterval(() => setTick((n) => n + 1), 20000);
        return () => clearInterval(id);
    }, [savedAt]);

    if (status === 'saving') {
        return (
            <span className="save-status" aria-live="polite">
                <Icon name="refresh" className="text-sm animate-spin" />
                Saving…
            </span>
        );
    }

    if (status === 'saved' && savedAt) {
        return (
            <span className="save-status" aria-live="polite">
                <span className="save-status__dot" aria-hidden="true" />
                Saved · {relTime(savedAt)}
            </span>
        );
    }

    if (status === 'offline') {
        // Server unreachable, but the local copy is safe and will sync when the connection returns.
        return (
            <span className="save-status save-status--offline" aria-live="polite">
                <Icon name="cloud_off" className="text-sm" />
                Saved on this device
            </span>
        );
    }

    return null;
};

export default SaveStatus;
