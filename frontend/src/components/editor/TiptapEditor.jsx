import { useCallback, useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import toast from 'react-hot-toast';
import { getExtensions } from './extensions';
import EditorToolbar from './EditorToolbar';
import BubbleMenuComponent from './BubbleMenuComponent';
import EmbedInsertModal from './EmbedInsertModal';
import LinkInsertModal from './LinkInsertModal';
import EditorStats from './EditorStats';
import BlockHandle from './BlockHandle';
import { mentionSuggestionConfig } from './MentionList';
import { uploadImageWithMeta } from '../../common/aws';

const TiptapEditor = ({ content, onUpdate, onEditorReady, saveStatus, savedAt }) => {
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const debounceRef = useRef(null);
  const editorRef = useRef(null);

  // Upload a dropped/pasted image File to S3 and insert it (at `pos` when dropping, else at the caret).
  const uploadAndInsertImage = useCallback(async (file, pos) => {
    const ed = editorRef.current;
    if (!ed || !file?.type?.startsWith('image/')) return;
    const loadingToast = toast.loading('Uploading image…');
    try {
      const { url, width, height } = await uploadImageWithMeta(file);
      if (url) {
        const chain = ed.chain().focus();
        if (typeof pos === 'number') chain.setTextSelection(pos);
        chain.setImage({ src: url, width, height }).run();
        toast.success('Image uploaded', { id: loadingToast });
      } else {
        toast.error('Upload failed. Please try again.', { id: loadingToast });
      }
    } catch {
      toast.error('Upload failed. Please try again.', { id: loadingToast });
    }
  }, []);

  // The block-reorder handles are a hover-only, left-gutter affordance — unusable on touch and
  // off-canvas on narrow screens — so we render them on desktop only.
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window === 'undefined' || window.matchMedia('(min-width: 768px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const handleUpdate = useCallback(
    ({ editor }) => {
      if (!onUpdate) return;

      // Debounce content updates to avoid excessive parent re-renders
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onUpdate(editor.getJSON());
      }, 300);
    },
    [onUpdate]
  );

  const handleCreate = useCallback(
    ({ editor }) => {
      editorRef.current = editor;
      onEditorReady?.(editor);
    },
    [onEditorReady]
  );

  const editor = useEditor({
    extensions: getExtensions({ mentionSuggestion: mentionSuggestionConfig }),
    content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: handleUpdate,
    onCreate: handleCreate,
    editorProps: {
      attributes: {
        class: 'tiptap-content prose notranslate',
        // Stop mobile browsers from offering to translate / auto-translating the draft you're writing.
        translate: 'no',
      },
      // Paste or drag-drop an image file → upload to S3 and insert it, instead of the browser
      // navigating away (drop) or inserting a transient blob/data: URL that rots on reload (paste).
      handlePaste: (view, event) => {
        const image = Array.from(event.clipboardData?.files || []).find((f) => f.type.startsWith('image/'));
        if (!image) return false;
        event.preventDefault();
        uploadAndInsertImage(image);
        return true;
      },
      handleDrop: (view, event) => {
        const image = Array.from(event.dataTransfer?.files || []).find((f) => f.type.startsWith('image/'));
        if (!image) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        uploadAndInsertImage(image, pos);
        return true;
      },
      // Ctrl/Cmd-K opens the link modal (the near-universal "add link" shortcut; otherwise the
      // browser's address-bar/search shortcut steals it).
      handleKeyDown: (view, event) => {
        if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && (event.key === 'k' || event.key === 'K')) {
          event.preventDefault();
          setShowLinkModal(true);
          return true;
        }
        return false;
      },
    },
  });

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleOpenEmbed = useCallback(() => {
    setShowEmbedModal(true);
  }, []);

  const handleCloseEmbed = useCallback(() => {
    setShowEmbedModal(false);
  }, []);

  const handleOpenLink = useCallback(() => setShowLinkModal(true), []);
  const handleCloseLink = useCallback(() => setShowLinkModal(false), []);

  return (
    <div className="tiptap-editor-wrapper notranslate" translate="no">
      <EditorToolbar editor={editor} onEmbedClick={handleOpenEmbed} onLinkClick={handleOpenLink} saveStatus={saveStatus} savedAt={savedAt} />
      <BubbleMenuComponent editor={editor} />
      <div className="tiptap-content-relative">
        {isDesktop && <BlockHandle editor={editor} />}
        <EditorContent editor={editor} className="tiptap-content-area" />
      </div>
      {/* Bottom footer stats — desktop only. On mobile they move up next to the save indicator so
          they stay visible while writing (see blog-editor's mobile status line). */}
      <EditorStats editor={editor} className="editor-stats max-md:hidden" />
      {showEmbedModal && (
        <EmbedInsertModal editor={editor} onClose={handleCloseEmbed} />
      )}
      {showLinkModal && (
        <LinkInsertModal editor={editor} onClose={handleCloseLink} />
      )}
    </div>
  );
};

export default TiptapEditor;
