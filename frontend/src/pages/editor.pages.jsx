import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { UserContext } from "../App";
import { Navigate, useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import BlogEditor from "../components/blog-editor.component";
import PublishForm from "../components/publish-form.component";
import Loader from "../components/loader.component";
import Icon from "../components/Icon";
import api from "../common/api";
import { toast } from "react-hot-toast";
import { useDraftAutosave, blogIsMeaningful, blogSignature } from "../hooks/useDraftAutosave";
import { getLocalDraft, gcLocalDrafts } from "../common/editor-local-store";

const blogStructure = {
    title: "",
    banner: "",
    content: [],
    tags: [],
    des: "",
    author: { personal_info: { } }
}

export const EditorContext = createContext({ });

// Merge a restored local snapshot onto a base (a loaded server draft, or the empty structure).
const applyLocalSnapshot = (base, local) => ({
    ...base,
    title: local.title ?? base.title ?? "",
    banner: local.banner ?? base.banner ?? "",
    content: local.content ?? base.content ?? [],
    des: local.des ?? base.des ?? "",
    tags: local.tags ?? base.tags ?? [],
});

// True if a local snapshot holds edits the server draft hasn't seen. blogSignature normalizes the
// server's array-wrapped content ([{doc}]) to the editor/local shape ({doc}) so equal content matches.
const localHasUnsyncedEdits = (local, serverBlog) => blogSignature(local) !== blogSignature(serverBlog);

const Editor = () => {

    let { blog_id } = useParams();
    const navigate = useNavigate();
    const [ searchParams, setSearchParams ] = useSearchParams();

    const [ blog, setBlog ] = useState(blogStructure);
    // Which phase we're on. Seeded from the URL (?step=publish) so a refresh — or browser back/forward —
    // lands on the same step instead of snapping back to phase 1.
    const [ editorState, setEditorState ] = useState(
        searchParams.get("step") === "publish" ? "publish" : "editor"
    );
    const [ textEditor, setTextEditor ] = useState(null);
    const [ loading, setLoading ] = useState(true);
    // Signature of what the server currently holds (set once the existing draft loads); lets the autosave
    // hook tell whether restored-but-unsynced local edits still need pushing up.
    const [ serverContentSig, setServerContentSig ] = useState(null);
    // When the hydrated content was last saved, so the indicator shows "Saved · Xm ago" immediately on
    // reopen instead of staying blank until the first edit.
    const [ hydratedSavedAt, setHydratedSavedAt ] = useState(null);
    // Set when loading an EXISTING draft fails, so we can render an explicit in-editor error state
    // instead of handing null to BlogEditor (which threw and dead-ended in the global ErrorBoundary).
    // Shape: { status } — the HTTP status, so a deleted/unknown draft (404) reads differently from a
    // network/server failure. Never set for a brand-new post (no fetch happens).
    const [ loadError, setLoadError ] = useState(null);
    // Bumped by "Try again" to re-run the load effect.
    const [ reloadKey, setReloadKey ] = useState(0);

    let { userAuth: {access_token, username} } = useContext(UserContext);

    // Storage key for this editing session: one "unsaved new post" slot per user, or the draft's id.
    const draftKey = blog_id ? `blog:${blog_id}` : (username ? `new:${username}` : null);

    // Server autosave applies ONLY to an existing DRAFT — never a brand-new post (kept local until the
    // user commits, per design) and never a published post (its live content must not change without an
    // explicit re-publish).
    const serverEnabled = Boolean(blog_id) && blog?.draft === true;

    // How a draft is pushed to the server. Omits `publication` so autosave never changes it (that's an
    // explicit phase-2 action; the server preserves it when the field is absent).
    const serverSave = useCallback(async (b) => {
        // Bounded timeout so a stalled/black-holed request rejects (no response → treated as a transient
        // failure that retries) instead of hanging the "Saving…" indicator forever.
        await api.post("/create-blog", {
            id: blog_id,
            title: b.title, banner: b.banner, des: b.des,
            tags: b.tags, content: b.content, draft: true,
        }, { timeout: 20000 });
    }, [blog_id]);

    // Autosave engine: local safety net always, plus server sync for existing drafts (Phase A + B).
    // Enabled only after hydration so it never re-saves loaded content as if it were a user edit.
    const { saveStatus, savedAt, clearLocalDraft } = useDraftAutosave({
        // Never autosave while the draft failed to load — the editor state is a placeholder, not the user's work.
        draftKey, blog, enabled: !loading && !loadError && !!draftKey,
        serverEnabled, serverContentSig, serverSave, hydratedSavedAt,
    });

    useEffect(() => {

        gcLocalDrafts(); // opportunistic cleanup of stale snapshots
        let cancelled = false;

        (async () => {
            // 1. Load the server draft if we're editing an existing post.
            let serverBlog = null;
            if (blog_id) {
                try {
                    const { data } = await api.post("/get-blog", { blog_id, draft: true, mode: 'edit' });
                    serverBlog = data.blog;
                    if (serverBlog.author.personal_info.username !== username) {
                        toast.error("You don't have permission to edit this blog");
                        navigate("/");
                        return;
                    }
                } catch (err) {
                    if (!cancelled) { setLoadError({ status: err?.response?.status ?? null }); setLoading(false); }
                    return;
                }
            }

            // 2. Reconcile with any locally-saved unsynced work (the crash/close/refresh safety net).
            const local = draftKey ? await getLocalDraft(draftKey) : null;
            if (cancelled) return;

            let hydrated = serverBlog || blogStructure;
            let restored = false;
            if (blog_id && serverBlog) {
                // Existing draft: restore local only if it has edits the server never received (e.g. the
                // user closed the tab before the last manual save).
                if (local && blogIsMeaningful(local) && localHasUnsyncedEdits(local, serverBlog)) {
                    hydrated = applyLocalSnapshot(serverBlog, local);
                    restored = true;
                }
            } else if (!blog_id && local && blogIsMeaningful(local)) {
                // Brand-new post: restore the last unsaved local draft.
                hydrated = applyLocalSnapshot(blogStructure, local);
                restored = true;
            }

            // Record what the server currently holds so the hook knows whether restored local edits
            // still need pushing up (null for a brand-new post — nothing on the server yet).
            setServerContentSig(serverBlog ? blogSignature(serverBlog) : null);
            // Last-saved time for the reopen indicator: the local snapshot's write time if we have one
            // (covers new posts + any draft autosaved on this device), else the server draft's updatedAt.
            setHydratedSavedAt(
                local?.updatedAt
                || (serverBlog?.updatedAt ? new Date(serverBlog.updatedAt).getTime() : null)
            );
            setBlog(hydrated);
            // Only honor a ?step=publish refresh/deep-link if there's actually content to publish —
            // otherwise fall back to phase 1 (the sync effect below will drop the stale param).
            if (editorState === "publish" && !blogIsMeaningful(hydrated)) {
                setEditorState("editor");
            }
            setLoading(false);
            if (restored) {
                toast.success("Restored your unsaved work", { duration: 4000 });
            }
        })();

        return () => { cancelled = true; };

    }, [reloadKey])

    // "Try again" on the load-error state: clear the error and re-run the load effect in place, so the
    // user never has to refresh (which previously just re-ran the same failing fetch into a crash).
    const retryLoad = () => {
        setLoadError(null);
        setLoading(true);
        setReloadKey(k => k + 1);
    };

    // Keep the URL's ?step in sync with the current phase so a refresh / back / forward stays put.
    // `replace` so stepping between phases doesn't pile up history entries.
    useEffect(() => {
        const params = new URLSearchParams(searchParams);
        const urlHasPublish = params.get("step") === "publish";
        if (editorState === "publish" && !urlHasPublish) {
            params.set("step", "publish");
            setSearchParams(params, { replace: true });
        } else if (editorState !== "publish" && urlHasPublish) {
            params.delete("step");
            setSearchParams(params, { replace: true });
        }
    }, [editorState, searchParams, setSearchParams])

    return(
        // by using this "EditorContext.Provider" now we can use all states "blog, setBlog, editorState, setEditorState" inside the "BlogEditor & PublishForm" components.
        <EditorContext.Provider value={{ blog, setBlog, editorState, setEditorState, textEditor, setTextEditor, saveStatus, savedAt, clearLocalDraft, setServerContentSig }}>
            {
                access_token === null ? <Navigate to="/signin" />
                :
                loading ? <Loader /> :
                loadError ?
                    // A 404 means the draft is gone (deleted, or a bad id) — a Retry could never succeed,
                    // so it only gets a way back. Anything else is a network/server failure worth retrying.
                    <div className="network-error">
                        <div className="network-error__icon-wrap">
                            <Icon name={loadError.status === 404 ? "search_off" : "cloud_off"} className="network-error__icon" />
                        </div>
                        <h3 className="network-error__title">
                            { loadError.status === 404 ? "Draft not found" : "Couldn't load this draft" }
                        </h3>
                        <p className="network-error__subtitle">
                            {
                                loadError.status === 404
                                    ? "It may have been deleted, or this link isn't valid anymore."
                                    : "Something went wrong while loading it. Check your connection and try again."
                            }
                        </p>
                        { loadError.status !== 404 &&
                            <button className="network-error__retry" onClick={retryLoad}>
                                <Icon name="refresh" className="text-base" />
                                Try again
                            </button>
                        }
                        <Link to="/dashboard/blogs?tab=draft" className="link underline mt-2">Back to drafts</Link>
                    </div>
                :
                editorState == "editor" ? <BlogEditor/> : <PublishForm/>
            }
        </EditorContext.Provider>
    )
}

export default Editor;
