import { memo, useState, useCallback, useEffect, useRef } from 'react';
import Icon from '../Icon';

/**
 * LinkInsertModal — Replaces the ugly window.prompt() for link insertion.
 * Provides URL + display text fields, detects existing link on selection,
 * and supports Enter to confirm.
 */
const LinkInsertModal = memo(({ editor, onClose }) => {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const backdropRef = useRef(null);

  // Pre-fill from existing link or selection text
  useEffect(() => {
    if (!editor) return;

    const { href } = editor.getAttributes('link');
    if (href) setUrl(href);

    const { from, to, empty } = editor.state.selection;
    if (!empty) {
      const selectedText = editor.state.doc.textBetween(from, to, ' ');
      setText(selectedText);
    }

    // Focus after a tick so the modal is mounted
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [editor]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    if (!editor) return;
    const trimmed = url.trim();

    if (!trimmed) {
      // Remove link if URL cleared
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      onClose();
      return;
    }

    // Auto-prefix https if missing
    const finalUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    // If there's display text and no selection, insert it
    const { empty } = editor.state.selection;
    if (text.trim() && empty) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          marks: [{ type: 'link', attrs: { href: finalUrl, target: '_blank' } }],
          text: text.trim(),
        })
        .run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: finalUrl, target: '_blank' })
        .run();
    }

    onClose();
  }, [editor, url, text, onClose]);

  const handleRemove = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onClose();
  }, [editor, onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  }, [handleConfirm]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === backdropRef.current) onClose();
  }, [onClose]);

  const hasExistingLink = editor ? !!editor.getAttributes('link').href : false;

  return (
    <div className="embed-modal-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className="embed-modal" role="dialog" aria-label="Insert link" style={{ maxWidth: '440px' }}>

        {/* Header */}
        <div className="embed-modal__header">
          <div className="embed-modal__header-left">
            <Icon name="link" className="text-xl" />
            <span className="embed-modal__title">{hasExistingLink ? 'Edit Link' : 'Insert Link'}</span>
          </div>
          <button type="button" className="embed-modal__close" onClick={onClose} aria-label="Close">
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        <p className="embed-modal__subtitle">
          Add a URL and optional display text
        </p>

        {/* URL input */}
        <div className="embed-modal__input-wrap">
          <Icon name="language" className="embed-modal__input-icon" />
          <input
            ref={inputRef}
            type="url"
            className="embed-modal__input"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
          />
          {url && (
            <button
              type="button"
              className="embed-modal__input-clear"
              onClick={() => { setUrl(''); inputRef.current?.focus(); }}
              aria-label="Clear"
            >
              <Icon name="close" className="text-sm" />
            </button>
          )}
        </div>

        {/* Display text input */}
        <div className="embed-modal__input-wrap" style={{ marginTop: '8px' }}>
          <Icon name="title" className="embed-modal__input-icon" />
          <input
            type="text"
            className="embed-modal__input"
            placeholder="Display text (optional)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
          />
        </div>

        {/* Footer */}
        <div className="embed-modal__footer">
          {hasExistingLink && (
            <button
              type="button"
              className="flex items-center gap-1 text-[#dc2626] hover:bg-[#dc2626]/10 px-4 py-2 rounded-md text-sm font-medium transition-colors mr-auto"
              onClick={handleRemove}
            >
              <Icon name="link_off" className="text-base" />
              Remove
            </button>
          )}
          <button
            type="button"
            className="text-dark-grey hover:text-black hover:bg-grey/80 px-4 py-2 rounded-md text-sm font-medium transition-colors mr-2"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex items-center gap-1 bg-black text-white px-5 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleConfirm}
            disabled={!url.trim()}
          >
            {hasExistingLink ? 'Update' : 'Insert'}
          </button>
        </div>

      </div>
    </div>
  );
});

LinkInsertModal.displayName = 'LinkInsertModal';

export default LinkInsertModal;
