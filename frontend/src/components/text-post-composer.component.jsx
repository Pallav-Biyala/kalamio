import { useState, useContext, useRef, useEffect, useCallback } from "react";
import { UserContext } from "../App";
import Icon from "./Icon";
import Avatar from "./Avatar";
import { uploadImage } from "../common/aws";
import api from "../common/api";
import toast from "react-hot-toast";
import { getDay } from "../common/date";

const MAX_CHARS = 9999;
const MAX_IMAGES = 4;
const MAX_POLL_OPTIONS = 6;

const TextPostComposer = ({ isOpen, onClose, onPosted, editBlogId }) => {

    const { userAuth: { access_token, profile_img, fullname, username } } = useContext(UserContext);

    // ── Composer state ──
    const [textContent, setTextContent] = useState("");
    const [images, setImages] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [showPoll, setShowPoll] = useState(false);
    const [pollQuestion, setPollQuestion] = useState("");
    const [pollOptions, setPollOptions] = useState(["", ""]);
    const [posting, setPosting] = useState(false);

    // ── View state: 'compose' or 'drafts' ──
    const [view, setView] = useState("compose");

    // ── Draft editing state ──
    const [editingDraftId, setEditingDraftId] = useState(null); // blog_id of draft being edited
    const [showDraftPopup, setShowDraftPopup] = useState(null); // 'save' | 'update' | null
    const [showDiscard, setShowDiscard] = useState(false);

    // ── Drafts list state ──
    const [drafts, setDrafts] = useState(null);
    const [draftSearch, setDraftSearch] = useState("");
    const [loadingDrafts, setLoadingDrafts] = useState(false);
    const [draftMenuOpen, setDraftMenuOpen] = useState(null); // blog_id of open menu

    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const searchTimeoutRef = useRef(null);

    // Auto-focus textarea when modal opens
    useEffect(() => {
        if (isOpen && view === 'compose' && textareaRef.current) {
            setTimeout(() => textareaRef.current.focus(), 100);
        }
    }, [isOpen, view]);

    // Reset everything when modal closes
    useEffect(() => {
        if (!isOpen) {
            setView("compose");
            resetComposer();
            setDrafts(null);
            setDraftSearch("");
            setEditingDraftId(null);
            setShowDraftPopup(null);
            setShowDiscard(false);
            setDraftMenuOpen(null);
        }
    }, [isOpen]);

    // Load existing post for editing
    useEffect(() => {
        if (isOpen && editBlogId) {
            api.post("/get-blog", { blog_id: editBlogId, mode: "edit" })
            .then(({ data: { blog } }) => {
                setTextContent(blog.text_content || "");
                setImages(blog.images || []);
                if (blog.poll && blog.poll.options && blog.poll.options.length > 0) {
                    setShowPoll(true);
                    setPollQuestion(blog.poll.question || "");
                    setPollOptions(blog.poll.options.map(opt => opt.text || ""));
                }
                setEditingDraftId(blog.blog_id);
                setView("compose");
            })
            .catch(() => {
                toast.error("Failed to load post for editing");
            });
        }
    }, [isOpen, editBlogId]);

    // ── Helpers ──
    const hasContent = textContent.trim().length > 0 || images.length > 0;

    const resetComposer = () => {
        setTextContent("");
        setImages([]);
        setShowPoll(false);
        setPollQuestion("");
        setPollOptions(["", ""]);
        setEditingDraftId(null);
    };

    const resetAndClose = () => {
        resetComposer();
        onClose();
    };

    // ── Fetch drafts ──
    const fetchDrafts = useCallback((query = "") => {
        setLoadingDrafts(true);
        api.post("/user-written-blogs", {
            page: 1,
            draft: true,
            content_type: "text_post",
            query: query || undefined
        }).then(({ data }) => {
            setDrafts(data.blogs || []);
        }).catch(() => {
            toast.error("Failed to load drafts");
            setDrafts([]);
        }).finally(() => {
            setLoadingDrafts(false);
        });
    }, []);

    // Fetch drafts when entering draft view
    useEffect(() => {
        if (view === "drafts") {
            fetchDrafts(draftSearch);
        }
    }, [view]);

    // Search drafts with debounce
    const handleDraftSearch = (val) => {
        setDraftSearch(val);
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            fetchDrafts(val);
        }, 400);
    };

    // ── Textarea ──
    const handleTextChange = (e) => {
        const val = e.target.value;
        if (val.length <= MAX_CHARS) {
            setTextContent(val);
        }
        e.target.style.height = "auto";
        e.target.style.height = e.target.scrollHeight + "px";
    };

    // ── Image upload ──
    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const remaining = MAX_IMAGES - images.length;
        if (remaining <= 0) {
            toast.error(`Maximum ${MAX_IMAGES} images allowed`);
            return;
        }
        const toUpload = files.slice(0, remaining);
        setUploading(true);
        try {
            for (const file of toUpload) {
                if (!file.type.startsWith("image/")) {
                    toast.error("Please select image files only");
                    continue;
                }
                const url = await uploadImage(file);
                if (url) setImages(prev => [...prev, url]);
            }
        } catch {
            toast.error("Image upload failed");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const removeImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    // ── Poll ──
    const addPollOption = () => {
        if (pollOptions.length < MAX_POLL_OPTIONS) {
            setPollOptions(prev => [...prev, ""]);
        }
    };
    const updatePollOption = (index, value) => {
        setPollOptions(prev => prev.map((opt, i) => i === index ? value : opt));
    };
    const removePollOption = (index) => {
        if (pollOptions.length > 2) {
            setPollOptions(prev => prev.filter((_, i) => i !== index));
        }
    };
    const togglePoll = () => {
        if (showPoll) {
            setShowPoll(false);
            setPollQuestion("");
            setPollOptions(["", ""]);
        } else {
            setShowPoll(true);
        }
    };

    // ── Build blog payload ──
    const buildPayload = (draft = false) => {
        let pollData = null;
        if (showPoll) {
            const validOptions = pollOptions.filter(opt => opt.trim());
            if (validOptions.length >= 2) {
                pollData = {
                    question: pollQuestion.trim(),
                    options: validOptions.map(text => ({ text: text.trim(), votes: 0 })),
                    total_votes: 0
                };
            }
        }
        return {
            type: "text_post",
            text_content: textContent,
            images,
            poll: pollData,
            title: "",
            banner: "",
            content: {},
            des: "",
            tags: [],
            draft,
            ...(editingDraftId ? { id: editingDraftId } : {})
        };
    };

    // ── Post (publish) ──
    const handlePost = async () => {
        if (!textContent.trim()) return toast.error("Write something to post");
        if (showPoll) {
            const validOptions = pollOptions.filter(opt => opt.trim());
            if (validOptions.length < 2) return toast.error("Poll needs at least 2 options");
        }
        setPosting(true);
        const loadingToast = toast.loading(editingDraftId ? "Publishing..." : "Posting...");
        try {
            await api.post("/create-blog", buildPayload(false));
            toast.dismiss(loadingToast);
            toast.success("Posted! 🎉");
            resetAndClose();
            if (onPosted) onPosted();
        } catch (err) {
            toast.dismiss(loadingToast);
            toast.error(err?.response?.data?.error || "Failed to post");
        } finally {
            setPosting(false);
        }
    };

    // ── Save / Update draft ──
    const saveDraftAndGoToList = async () => {
        setShowDraftPopup(null);
        if (!textContent.trim()) {
            toast.error("Can't save an empty draft");
            return;
        }
        const loadingToast = toast.loading(editingDraftId ? "Updating draft..." : "Saving draft...");
        try {
            await api.post("/create-blog", buildPayload(true));
            toast.dismiss(loadingToast);
            toast.success(editingDraftId ? "Draft updated" : "Saved to drafts");
            resetComposer();
            setView("drafts");
            fetchDrafts("");
            setDraftSearch("");
        } catch (err) {
            toast.dismiss(loadingToast);
            toast.error(err?.response?.data?.error || "Failed to save draft");
        }
    };

    // ── Don't update, just go to list ──
    const skipAndGoToList = () => {
        setShowDraftPopup(null);
        setView("drafts");
        fetchDrafts("");
        setDraftSearch("");
    };

    // ── Drafts button click logic ──
    const handleDraftsClick = () => {
        if (editingDraftId) {
            // Case 3: Editing existing draft
            if (hasContent) {
                setShowDraftPopup("update");
            } else {
                // Draft was emptied out, just go to list
                resetComposer();
                setView("drafts");
                fetchDrafts("");
            }
        } else if (hasContent) {
            // Case 2: New post with content
            setShowDraftPopup("save");
        } else {
            // Case 1: Empty editor
            setView("drafts");
            fetchDrafts("");
        }
    };

    // ── Load a draft into editor ──
    const loadDraft = (draft) => {
        setTextContent(draft.text_content || "");
        setImages(draft.images || []);
        if (draft.poll && draft.poll.options && draft.poll.options.length > 0) {
            setShowPoll(true);
            setPollQuestion(draft.poll.question || "");
            setPollOptions(draft.poll.options.map(opt => opt.text || ""));
        } else {
            setShowPoll(false);
            setPollQuestion("");
            setPollOptions(["", ""]);
        }
        setEditingDraftId(draft.blog_id);
        setDraftMenuOpen(null);
        setView("compose");
    };

    // ── Delete a draft ──
    const deleteDraft = async (blogId) => {
        setDraftMenuOpen(null);
        const loadingToast = toast.loading("Deleting...");
        try {
            await api.post("/delete-blog", { blog_id: blogId });
            toast.dismiss(loadingToast);
            toast.success("Draft deleted");
            setDrafts(prev => prev.filter(d => d.blog_id !== blogId));
        } catch {
            toast.dismiss(loadingToast);
            toast.error("Failed to delete draft");
        }
    };

    // ── Cancel button logic ──
    const handleCancel = () => {
        if (hasContent) {
            setShowDiscard(true);
        } else {
            resetAndClose();
        }
    };

    const confirmDiscard = () => {
        setShowDiscard(false);
        resetAndClose();
    };
    const cancelDiscard = () => setShowDiscard(false);

    const saveDraftFromDiscard = async () => {
        setShowDiscard(false);
        if (!textContent.trim()) {
            toast.error("Can't save an empty draft");
            return;
        }
        const loadingToast = toast.loading(editingDraftId ? "Updating draft..." : "Saving draft...");
        try {
            await api.post("/create-blog", buildPayload(true));
            toast.dismiss(loadingToast);
            toast.success(editingDraftId ? "Draft updated" : "Saved to drafts");
            resetAndClose();
        } catch (err) {
            toast.dismiss(loadingToast);
            toast.error(err?.response?.data?.error || "Failed to save draft");
        }
    };

    // ── Handle overlay click ──
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) handleCancel();
    };

    // Char count styling
    const charRemaining = MAX_CHARS - textContent.length;
    const charClass = charRemaining < 100 ? (charRemaining < 0 ? "tp-composer__char-count--danger" : "tp-composer__char-count--warn") : "";

    if (!isOpen) return null;

    // ═══════════════════════════════════════════════════
    // DRAFTS VIEW
    // ═══════════════════════════════════════════════════
    if (view === "drafts") {
        return (
            <div className="tp-composer-overlay" onClick={handleOverlayClick}>
                <div className="tp-composer">

                    {/* Drafts Header */}
                    <div className="tp-composer__header">
                        <button className="tp-drafts__back" onClick={() => {
                            setView("compose");
                        }}>
                            <Icon name="arrow_back" className="text-xl" />
                        </button>
                        <span className="tp-drafts__title">Drafts</span>
                        <div style={{ width: 36 }} /> {/* spacer for centering */}
                    </div>

                    {/* Search */}
                    <div className="tp-drafts__search">
                        <Icon name="search" className="tp-drafts__search-icon" />
                        <input
                            type="text"
                            className="tp-drafts__search-input"
                            placeholder="Search drafts..."
                            value={draftSearch}
                            onChange={(e) => handleDraftSearch(e.target.value)}
                        />
                        {draftSearch && (
                            <button className="tp-drafts__search-clear" onClick={() => { setDraftSearch(""); fetchDrafts(""); }}>
                                <Icon name="close" className="text-lg" />
                            </button>
                        )}
                    </div>

                    {/* Draft List */}
                    <div className="tp-drafts__list" onClick={() => setDraftMenuOpen(null)}>
                        {/* Create New button */}
                        <button className="tp-drafts__new-btn" onClick={() => {
                            resetComposer();
                            setView("compose");
                        }}>
                            <div className="tp-drafts__new-icon">
                                <Icon name="add" className="text-xl" />
                            </div>
                            <span>Create new</span>
                        </button>

                        {loadingDrafts ? (
                            <div className="tp-drafts__empty">
                                <Icon name="hourglass_empty" className="text-3xl" style={{ opacity: 0.4 }} />
                                <span>Loading drafts...</span>
                            </div>
                        ) : drafts && drafts.length === 0 ? (
                            <div className="tp-drafts__empty">
                                <Icon name="draft" className="text-3xl" style={{ opacity: 0.3 }} />
                                <span>{draftSearch ? "No matching drafts" : "No drafts yet"}</span>
                            </div>
                        ) : (
                            drafts && drafts.map(draft => (
                                <div key={draft.blog_id} className="tp-drafts__item" onClick={() => loadDraft(draft)}>
                                    <div className="tp-drafts__item-avatar">
                                        <Avatar src={profile_img} alt={fullname} size={36} />
                                    </div>
                                    <div className="tp-drafts__item-content">
                                        <p className="tp-drafts__item-text">
                                            {draft.text_content
                                                ? draft.text_content.substring(0, 100) + (draft.text_content.length > 100 ? '...' : '')
                                                : 'Empty draft'}
                                        </p>
                                        <span className="tp-drafts__item-meta">
                                            {draft.publishedAt ? getDay(draft.publishedAt) : 'No date'}
                                            {draft.images && draft.images.length > 0 && (
                                                <><span className="tp-drafts__dot">·</span><Icon name="image" className="text-sm" /> {draft.images.length}</>
                                            )}
                                            {draft.poll && draft.poll.options?.length > 0 && (
                                                <><span className="tp-drafts__dot">·</span><Icon name="poll" className="text-sm" /></>
                                            )}
                                        </span>
                                    </div>
                                    <button className="tp-drafts__item-menu" onClick={(e) => {
                                        e.stopPropagation();
                                        setDraftMenuOpen(draftMenuOpen === draft.blog_id ? null : draft.blog_id);
                                    }}>
                                        <Icon name="more_horiz" />
                                    </button>

                                    {draftMenuOpen === draft.blog_id && (
                                        <div className="tp-drafts__item-dropdown">
                                            <button className="tp-drafts__item-dropdown-btn tp-drafts__item-dropdown-btn--delete"
                                                onClick={(e) => { e.stopPropagation(); deleteDraft(draft.blog_id); }}>
                                                <Icon name="delete" className="text-lg" /> Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════
    // COMPOSE VIEW
    // ═══════════════════════════════════════════════════
    return (
        <div className="tp-composer-overlay" onClick={handleOverlayClick}>
            <div className="tp-composer">

                {/* Header */}
                <div className="tp-composer__header">
                    <div className="tp-composer__author">
                        <Avatar src={profile_img} alt={fullname} size={40} />
                        <div>
                            <div className="tp-composer__author-name">{fullname}</div>
                            {editingDraftId && <span className="tp-composer__draft-badge">Editing draft</span>}
                        </div>
                    </div>
                    <button className="tp-composer__drafts-btn" onClick={handleDraftsClick}>
                        <Icon name="draft" className="text-lg" />
                        Drafts
                    </button>
                </div>

                {/* Body */}
                <div className="tp-composer__body">
                    <textarea
                        ref={textareaRef}
                        className="tp-composer__textarea"
                        placeholder="Write to the world..."
                        value={textContent}
                        onChange={handleTextChange}
                        maxLength={MAX_CHARS}
                    />

                    <div className={`tp-composer__char-count ${charClass}`}>
                        {textContent.length > 0 && `${textContent.length.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`}
                    </div>

                    {/* Images */}
                    {images.length > 0 && (
                        <div className={`tp-composer__images tp-composer__images--${Math.min(images.length, 4)}`}>
                            {images.map((url, i) => (
                                <div key={i} className="tp-composer__image-wrapper">
                                    <img src={url} alt={`Upload ${i + 1}`} />
                                    <button
                                        className="tp-composer__image-remove"
                                        onClick={() => removeImage(i)}
                                        aria-label="Remove image"
                                    >
                                        <Icon name="close" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Poll Creator */}
                    {showPoll && (
                        <div className="tp-composer__poll">
                            <div className="tp-composer__poll-header">
                                <span className="tp-composer__poll-title flex-1 flex items-center">
                                    <Icon name="poll" className="text-base align-middle mr-2" />
                                    <input 
                                        type="text" 
                                        placeholder="Ask a question..."
                                        value={pollQuestion}
                                        onChange={(e) => setPollQuestion(e.target.value)}
                                        className="bg-transparent border-none outline-none text-[15px] w-full font-medium placeholder:font-normal placeholder:opacity-70"
                                    />
                                </span>
                                <button className="tp-composer__poll-remove" onClick={togglePoll} aria-label="Remove poll">
                                    <Icon name="close" />
                                </button>
                            </div>

                            {pollOptions.map((opt, i) => (
                                <div key={i} className="tp-composer__poll-option">
                                    <input
                                        type="text"
                                        placeholder={`Option ${i + 1}`}
                                        value={opt}
                                        onChange={(e) => updatePollOption(i, e.target.value)}
                                        maxLength={100}
                                    />
                                    {pollOptions.length > 2 && (
                                        <button
                                            className="tp-composer__poll-remove"
                                            onClick={() => removePollOption(i)}
                                            aria-label="Remove option"
                                        >
                                            <Icon name="close" className="text-base" />
                                        </button>
                                    )}
                                </div>
                            ))}

                            {pollOptions.length < MAX_POLL_OPTIONS && (
                                <button className="tp-composer__poll-add" onClick={addPollOption}>
                                    <Icon name="add" className="text-lg" />
                                    Add another option
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="tp-composer__footer">
                    <div className="tp-composer__toolbar">
                        <button
                            className={`tp-composer__tool-btn ${images.length > 0 ? 'tp-composer__tool-btn--active' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={images.length >= MAX_IMAGES || uploading}
                            title="Add images"
                        >
                            <Icon name="image" />
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            hidden
                            onChange={handleImageUpload}
                        />

                        <button
                            className={`tp-composer__tool-btn ${showPoll ? 'tp-composer__tool-btn--active' : ''}`}
                            onClick={togglePoll}
                            title={showPoll ? "Remove poll" : "Add poll"}
                        >
                            <Icon name="poll" />
                        </button>
                    </div>

                    <div className="tp-composer__actions">
                        <button className="tp-composer__cancel-btn" onClick={handleCancel}>
                            Cancel
                        </button>
                        <button
                            className="tp-composer__post-btn"
                            onClick={handlePost}
                            disabled={!textContent.trim() || posting || uploading}
                        >
                            {posting ? "Posting..." : "Post"}
                        </button>
                    </div>
                </div>

            </div>

            {/* ── Discard Confirmation (Cancel button) ── */}
            {showDiscard && (
                <div className="tp-discard-overlay" onClick={cancelDiscard}>
                    <div className="tp-discard" onClick={(e) => e.stopPropagation()}>
                        <div className="tp-discard__icon">
                            <Icon name="delete_sweep" />
                        </div>
                        <h3 className="tp-discard__title">Discard post?</h3>
                        <p className="tp-discard__desc">You can save it as a draft to finish later.</p>
                        <div className="tp-discard__actions-col">
                            <button className="tp-discard__btn tp-discard__btn--draft" onClick={saveDraftFromDiscard}>
                                <Icon name="draft" className="text-lg" />
                                Save as Draft
                            </button>
                            <button className="tp-discard__btn tp-discard__btn--discard" onClick={confirmDiscard}>
                                <Icon name="delete" className="text-lg" />
                                Discard
                            </button>
                            <button className="tp-discard__btn tp-discard__btn--cancel" onClick={cancelDiscard}>
                                Keep editing
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Save to Drafts popup (Drafts button, Case 2: new post with content) ── */}
            {showDraftPopup === "save" && (
                <div className="tp-discard-overlay" onClick={() => setShowDraftPopup(null)}>
                    <div className="tp-discard" onClick={(e) => e.stopPropagation()}>
                        <div className="tp-discard__icon" style={{ background: 'rgb(var(--c-brand) / 0.1)', color: 'rgb(var(--c-brand))' }}>
                            <Icon name="draft" />
                        </div>
                        <h3 className="tp-discard__title">Save to drafts?</h3>
                        <p className="tp-discard__desc">Save this post to finish and publish later.</p>
                        <div className="tp-discard__actions-col">
                            <button className="tp-discard__btn tp-discard__btn--draft" onClick={saveDraftAndGoToList}>
                                <Icon name="draft" className="text-lg" />
                                Save
                            </button>
                            <button className="tp-discard__btn tp-discard__btn--discard" onClick={skipAndGoToList}>
                                <Icon name="delete" className="text-lg" />
                                Discard
                            </button>
                            <button className="tp-discard__btn tp-discard__btn--cancel" onClick={() => setShowDraftPopup(null)}>
                                Keep editing
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Update Draft popup (Drafts button, Case 3: editing existing draft) ── */}
            {showDraftPopup === "update" && (
                <div className="tp-discard-overlay" onClick={() => setShowDraftPopup(null)}>
                    <div className="tp-discard" onClick={(e) => e.stopPropagation()}>
                        <div className="tp-discard__icon" style={{ background: 'rgb(var(--c-brand) / 0.1)', color: 'rgb(var(--c-brand))' }}>
                            <Icon name="update" />
                        </div>
                        <h3 className="tp-discard__title">Update draft?</h3>
                        <p className="tp-discard__desc">Update draft and save it to post at a later time.</p>
                        <div className="tp-discard__actions-col">
                            <button className="tp-discard__btn tp-discard__btn--draft" onClick={saveDraftAndGoToList}>
                                <Icon name="draft" className="text-lg" />
                                Update
                            </button>
                            <button className="tp-discard__btn tp-discard__btn--discard" onClick={skipAndGoToList}>
                                Don't update
                            </button>
                            <button className="tp-discard__btn tp-discard__btn--cancel" onClick={() => setShowDraftPopup(null)}>
                                Keep editing
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default TextPostComposer;
