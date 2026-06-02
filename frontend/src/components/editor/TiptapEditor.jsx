import { useCallback, useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { getExtensions } from './extensions';
import EditorToolbar from './EditorToolbar';
import BubbleMenuComponent from './BubbleMenuComponent';
import EmbedInsertModal from './EmbedInsertModal';
import EditorStats from './EditorStats';
import BlockHandle from './BlockHandle';
import { mentionSuggestionConfig } from './MentionList';

const TiptapEditor = ({ content, onUpdate, onEditorReady }) => {
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const debounceRef = useRef(null);

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
        class: 'tiptap-content prose',
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
    <div className="tiptap-editor-wrapper">
      <EditorToolbar editor={editor} onEmbedClick={handleOpenEmbed} />
      <BubbleMenuComponent editor={editor} />
      <div className="tiptap-content-relative">
        <BlockHandle editor={editor} />
        <EditorContent editor={editor} className="tiptap-content-area" />
      </div>
      <EditorStats editor={editor} />
      {showEmbedModal && (
        <EmbedInsertModal editor={editor} onClose={handleCloseEmbed} />
      )}
    </div>
  );
};

export default TiptapEditor;
