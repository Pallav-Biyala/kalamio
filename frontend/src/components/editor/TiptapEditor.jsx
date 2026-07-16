import { useCallback, useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { getExtensions } from './extensions';
import EditorToolbar from './EditorToolbar';
import BubbleMenuComponent from './BubbleMenuComponent';
import EmbedInsertModal from './EmbedInsertModal';
import EditorStats from './EditorStats';
import BlockHandle from './BlockHandle';
import { mentionSuggestionConfig } from './MentionList';

const TiptapEditor = ({ content, onUpdate, onEditorReady, saveStatus, savedAt }) => {
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const debounceRef = useRef(null);

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

  return (
    <div className="tiptap-editor-wrapper notranslate" translate="no">
      <EditorToolbar editor={editor} onEmbedClick={handleOpenEmbed} saveStatus={saveStatus} savedAt={savedAt} />
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
    </div>
  );
};

export default TiptapEditor;
