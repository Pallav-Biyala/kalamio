import { memo, useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '../Icon';
import ToolbarButton from './ToolbarButton';
import ToolbarDivider from './ToolbarDivider';
import { uploadImage } from '../../common/aws';
import LinkInsertModal from './LinkInsertModal';
import SaveStatus from './SaveStatus';
import EditorStats from './EditorStats';

const EditorToolbar = ({ editor, onEmbedClick, saveStatus, savedAt }) => {
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [showLinkModal, setShowLinkModal] = useState(false);

  // Horizontal-scroll affordance: the toolbar's scrollbar is hidden, so users can't tell more tools are
  // reachable by scrolling. We watch scroll position + width and show a fade + a scroll chevron on each
  // edge that still has content beyond it.
  const scrollerRef = useRef(null);
  const [overflowLeft, setOverflowLeft] = useState(false);
  const [overflowRight, setOverflowRight] = useState(false);

  const updateOverflow = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setOverflowLeft(el.scrollLeft > 1);
    setOverflowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateOverflow();
    el.addEventListener('scroll', updateOverflow, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateOverflow) : null;
    ro?.observe(el);
    window.addEventListener('resize', updateOverflow);
    return () => {
      el.removeEventListener('scroll', updateOverflow);
      ro?.disconnect();
      window.removeEventListener('resize', updateOverflow);
    };
  }, [updateOverflow, editor]);

  const scrollToolbar = useCallback((dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(140, el.clientWidth * 0.7), behavior: 'smooth' });
  }, []);

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
      {/* MOBILE: live word/read/character counts + the save status, kept with the (sticky) toolbar so
          they stay visible while writing without a separate strip cluttering the nav. Single
          non-wrapping row — the counts take the space (and truncate on the right only in the extreme),
          the status keeps its size — so it never jumps between one and two lines. */}
      <div className="md:hidden flex items-center gap-3 px-3 pt-1.5 pb-1">
        <div className="flex-1 min-w-0 overflow-hidden">
          <EditorStats editor={editor} className="editor-stats--inline" />
        </div>
        <SaveStatus status={saveStatus} savedAt={savedAt} />
      </div>
      <div className={`editor-toolbar-scroll${overflowLeft ? ' is-overflow-left' : ''}${overflowRight ? ' is-overflow-right' : ''}`}>
      <div className="editor-toolbar" role="toolbar" aria-label="Editor formatting toolbar" ref={scrollerRef}>
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
        <button
          type="button"
          className="editor-toolbar-scroll-btn editor-toolbar-scroll-btn--left"
          onClick={() => scrollToolbar(-1)}
          aria-label="Scroll toolbar left"
          tabIndex={-1}
        >
          <Icon name="chevron_left" />
        </button>
        <button
          type="button"
          className="editor-toolbar-scroll-btn editor-toolbar-scroll-btn--right"
          onClick={() => scrollToolbar(1)}
          aria-label="More formatting tools"
          tabIndex={-1}
        >
          <Icon name="chevron_right" />
        </button>
      </div>
      {showLinkModal && (
        <LinkInsertModal editor={editor} onClose={() => setShowLinkModal(false)} />
      )}
    </div>
  );
  };

EditorToolbar.displayName = 'EditorToolbar';

export default EditorToolbar;
