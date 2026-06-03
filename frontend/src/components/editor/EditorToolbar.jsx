import { memo, useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import ToolbarButton from './ToolbarButton';
import ToolbarDivider from './ToolbarDivider';
import { uploadImage } from '../../common/aws';
import LinkInsertModal from './LinkInsertModal';

const EditorToolbar = ({ editor, onEmbedClick }) => {
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [showLinkModal, setShowLinkModal] = useState(false);

  if (!editor) return null;

  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }

    const loadingToast = toast.loading('Uploading image...');
    try {
      const url = await uploadImage(file);
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
        toast.success('Image uploaded!', { id: loadingToast });
      } else {
        toast.error('Upload failed. Please try again.', { id: loadingToast });
      }
    } catch {
      toast.error('Upload failed. Please try again.', { id: loadingToast });
    }

    // Reset input so the same file can be re-selected
    e.target.value = '';
  }, [editor]);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const loadingToast = toast.loading('Uploading file...');
    try {
      const url = await uploadImage(file);
      if (url) {
        editor.chain().focus().setFileAttachment({
          url: url,
          filename: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }).run();
        toast.success('File attached!', { id: loadingToast });
      } else {
        toast.error('Upload failed. Please try again.', { id: loadingToast });
      }
    } catch {
      toast.error('Upload failed. Please try again.', { id: loadingToast });
    }

    e.target.value = '';
  }, [editor]);

  const handleLinkToggle = useCallback(() => {
    setShowLinkModal(true);
  }, []);

  const handleHeadingChange = useCallback((e) => {
    const level = parseInt(e.target.value, 10);
    if (level === 0) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level }).run();
    }
  }, [editor]);

  const getCurrentHeadingLevel = () => {
    for (let i = 1; i <= 6; i++) {
      if (editor.isActive('heading', { level: i })) return i;
    }
    return 0;
  };

  const handleTableInsert = useCallback(() => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  return (
    <div className="editor-toolbar-sticky">
      <div className="editor-toolbar" role="toolbar" aria-label="Editor formatting toolbar">
        {/* Group 1 — History */}
        <div className="toolbar-group">
          <ToolbarButton
            icon="undo"
            label="Undo"
            onClick={() => editor.chain().focus().undo().run()}
            isDisabled={!editor.can().chain().focus().undo().run()}
          />
          <ToolbarButton
            icon="redo"
            label="Redo"
            onClick={() => editor.chain().focus().redo().run()}
            isDisabled={!editor.can().chain().focus().redo().run()}
          />
        </div>

        <ToolbarDivider />

        {/* Group 2 — Text Format */}
        <div className="toolbar-group">
          <ToolbarButton
            icon="format_bold"
            label="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            isDisabled={!editor.can().chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            icon="format_italic"
            label="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            isDisabled={!editor.can().chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            icon="format_underlined"
            label="Underline"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            isDisabled={!editor.can().chain().focus().toggleUnderline().run()}
          />
          <ToolbarButton
            icon="strikethrough_s"
            label="Strikethrough"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            isDisabled={!editor.can().chain().focus().toggleStrike().run()}
          />
          <ToolbarButton
            icon="code"
            label="Inline Code"
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive('code')}
            isDisabled={!editor.can().chain().focus().toggleCode().run()}
          />
          <ToolbarButton
            icon="ink_highlighter"
            label="Highlight"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            isActive={editor.isActive('highlight')}
          />
        </div>

        <ToolbarDivider />

        {/* Group 3 — Headings */}
        <div className="toolbar-group">
          <select
            className="toolbar-heading-select"
            value={getCurrentHeadingLevel()}
            onChange={handleHeadingChange}
            aria-label="Text style"
          >
            <option value={0}>Paragraph</option>
            <option value={1}>Heading 1</option>
            <option value={2}>Heading 2</option>
            <option value={3}>Heading 3</option>
            <option value={4}>Heading 4</option>
            <option value={5}>Heading 5</option>
            <option value={6}>Heading 6</option>
          </select>
        </div>

        <ToolbarDivider />

        {/* Group 4 — Lists & Quote */}
        <div className="toolbar-group">
          <ToolbarButton
            icon="format_list_bulleted"
            label="Bullet List"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
          />
          <ToolbarButton
            icon="format_list_numbered"
            label="Numbered List"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
          />
          <ToolbarButton
            icon="format_quote"
            label="Blockquote"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
          />
        </div>

        <ToolbarDivider />

        {/* Group 5 — Alignment */}
        <div className="toolbar-group">
          <ToolbarButton
            icon="format_align_left"
            label="Align Left"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            isActive={editor.isActive({ textAlign: 'left' })}
          />
          <ToolbarButton
            icon="format_align_center"
            label="Align Center"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            isActive={editor.isActive({ textAlign: 'center' })}
          />
          <ToolbarButton
            icon="format_align_right"
            label="Align Right"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            isActive={editor.isActive({ textAlign: 'right' })}
          />
        </div>

        <ToolbarDivider />

        {/* Group 6 — Insert */}
        <div className="toolbar-group">
          <ToolbarButton
            icon="horizontal_rule"
            label="Horizontal Rule"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          />
          <ToolbarButton
            icon="table_chart"
            label="Insert Table"
            onClick={handleTableInsert}
          />
          <ToolbarButton
            icon="image"
            label="Insert Image"
            onClick={() => imageInputRef.current?.click()}
          />
          <ToolbarButton
            icon="terminal"
            label="Code Block"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editor.isActive('codeBlock')}
          />
          <ToolbarButton
            icon="link"
            label={editor.isActive('link') ? 'Remove Link' : 'Insert Link'}
            onClick={handleLinkToggle}
            isActive={editor.isActive('link')}
          />
          <ToolbarButton
            icon="smart_display"
            label="Embed Media"
            onClick={onEmbedClick}
          />
          <ToolbarButton
            icon="attach_file"
            label="Attach File"
            onClick={() => fileInputRef.current?.click()}
          />
        </div>

        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
          aria-hidden="true"
        />
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          className="hidden"
          aria-hidden="true"
        />
      </div>
      {showLinkModal && (
        <LinkInsertModal editor={editor} onClose={() => setShowLinkModal(false)} />
      )}
    </div>
  );
  };

EditorToolbar.displayName = 'EditorToolbar';

export default EditorToolbar;
