import { memo, useState, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import Icon from '../Icon';
import { detectEmbed, EMBED_PROVIDERS } from './extensions/embed-registry';

const MAX_EMBEDS = 10;

const PROVIDER_CHIPS = [
  { key: 'youtube', icon: 'smart_display', label: 'YouTube', color: '#ff0000' },
  { key: 'twitter', icon: 'tag', label: 'X / Twitter', color: '#1da1f2' },
  { key: 'instagram', icon: 'photo_camera', label: 'Instagram', color: '#e1306c' },
  { key: 'github-repo', icon: 'code', label: 'GitHub', color: '#8b949e' },
  { key: 'spotify', icon: 'music_note', label: 'Spotify', color: '#1db954' },
  { key: 'linkedin', icon: 'work', label: 'LinkedIn', color: '#0a66c2' },
  { key: 'codepen', icon: 'code_blocks', label: 'CodePen', color: '#ffdd40' },
  { key: 'figma', icon: 'design_services', label: 'Figma', color: '#a259ff' },
  { key: 'loom', icon: 'videocam', label: 'Loom', color: '#625df5' },
  { key: 'reddit', icon: 'forum', label: 'Reddit', color: '#ff4500' },
  { key: 'tiktok', icon: 'movie', label: 'TikTok', color: '#010101' },
];

const EmbedInsertModal = memo(({ editor, onClose }) => {
  const [url, setUrl] = useState('');
  const [detected, setDetected] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const backdropRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleUrlChange = useCallback((e) => {
    const value = e.target.value;
    setUrl(value);
    setError('');
    setDetected(null);

    if (!value.trim()) return;
    const result = detectEmbed(value.trim());
    if (result) setDetected(result);
  }, []);

  const handlePaste = useCallback((e) => {
    setTimeout(() => {
      const value = e.target.value;
      if (!value.trim()) return;
      const result = detectEmbed(value.trim());
      if (result) setDetected(result);
    }, 0);
  }, []);

  const countCurrentEmbeds = useCallback(() => {
    if (!editor) return 0;
    let count = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'embed' || node.type.name === 'youtube') count++;
    });
    return count;
  }, [editor]);

  const handleConfirm = useCallback(() => {
    if (!editor) return;

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Please enter a URL.');
      return;
    }

    const result = detected || detectEmbed(trimmedUrl);
    if (!result) {
      setError('URL not recognized. Try pasting a direct link to a post, video, or profile.');
      return;
    }

    if (countCurrentEmbeds() >= MAX_EMBEDS) {
      toast.error(`Embed limit reached (max ${MAX_EMBEDS}).`);
      return;
    }

    if (result.provider === 'youtube') {
      editor.chain().focus().setYoutubeVideo({ src: trimmedUrl }).run();
    } else {
      editor.chain().focus().setEmbed({
        provider: result.provider,
        url: trimmedUrl,
        embedId: result.embedId,
      }).run();
    }

    onClose();
  }, [editor, url, detected, countCurrentEmbeds, onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  }, [handleConfirm]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === backdropRef.current) onClose();
  }, [onClose]);

  const providerInfo = detected ? EMBED_PROVIDERS[detected.provider] : null;
  const matchedChip = detected ? PROVIDER_CHIPS.find(c => c.key === detected.provider) : null;

  return (
    <div className="embed-modal-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className="embed-modal" role="dialog" aria-label="Insert embed">

        {/* Header */}
        <div className="embed-modal__header">
          <div className="embed-modal__header-left">
            <Icon name="add_link" className="text-xl" />
            <span className="embed-modal__title">Embed Media</span>
          </div>
          <button type="button" className="embed-modal__close" onClick={onClose} aria-label="Close">
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        {/* Subtitle */}
        <p className="embed-modal__subtitle">
          Paste a link to a post, video, profile, or repository
        </p>

        {/* Input */}
        <div className="embed-modal__input-wrap">
          <Icon name="link" className="embed-modal__input-icon" />
          <input
            ref={inputRef}
            type="url"
            className="embed-modal__input"
            placeholder="https://"
            value={url}
            onChange={handleUrlChange}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            spellCheck={false}
          />
          {url && (
            <button
              type="button"
              className="embed-modal__input-clear"
              onClick={() => { setUrl(''); setDetected(null); setError(''); inputRef.current?.focus(); }}
              aria-label="Clear"
            >
              <Icon name="close" className="text-sm" />
            </button>
          )}
        </div>

        {/* Detection result */}
        {detected && providerInfo && matchedChip && (
          <div className="embed-modal__detected" style={{ borderColor: matchedChip.color + '33' }}>
            <div className="embed-modal__detected-badge" style={{ background: matchedChip.color }}>
              <Icon name={matchedChip.icon} className="text-sm" style={{ color: '#fff' }} />
            </div>
            <span>{providerInfo.label} detected</span>
            <Icon name="check_circle" className="text-base" style={{ color: matchedChip.color, marginLeft: 'auto' }} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="embed-modal__error">
            <Icon name="error" className="text-base" />
            <span>{error}</span>
          </div>
        )}

        {/* Supported platforms chips */}
        <div className="embed-modal__platforms">
          <span className="embed-modal__platforms-label">Supported</span>
          <div className="embed-modal__chips">
            {PROVIDER_CHIPS.map(chip => (
              <span key={chip.key} className="embed-modal__chip" title={chip.label}>
                <Icon name={chip.icon} className="text-xs" />
                <span>{chip.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="embed-modal__footer">
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
            <Icon name="add" className="text-base" />
            Insert
          </button>
        </div>

      </div>
    </div>
  );
});

EmbedInsertModal.displayName = 'EmbedInsertModal';

export default EmbedInsertModal;
