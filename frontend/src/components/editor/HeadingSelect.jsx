import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../Icon';

const OPTIONS = [
  { value: 0, label: 'Paragraph' },
  { value: 1, label: 'Heading 1' },
  { value: 2, label: 'Heading 2' },
  { value: 3, label: 'Heading 3' },
  { value: 4, label: 'Heading 4' },
  { value: 5, label: 'Heading 5' },
  { value: 6, label: 'Heading 6' },
];

/**
 * HeadingSelect — a custom block-type dropdown that replaces the native <select> so the option list
 * matches the app's theme (native option popups can't be styled). The menu is portaled to <body> so
 * the toolbar's horizontal-overflow clipping never cuts it off.
 *
 * Not memoized on purpose: it must re-render with the toolbar on every selection change so the label
 * tracks where the caret is.
 */
const HeadingSelect = ({ editor }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  let currentLevel = 0;
  for (let i = 1; i <= 6; i++) {
    if (editor.isActive('heading', { level: i })) { currentLevel = i; break; }
  }
  const currentLabel = (OPTIONS.find((o) => o.value === currentLevel) || OPTIONS[0]).label;

  const toggle = useCallback(() => {
    setOpen((wasOpen) => {
      if (wasOpen) return false;
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 6, left: r.left, width: r.width });
      return true;
    });
  }, []);

  const apply = useCallback((value) => {
    // setHeading, NOT toggleHeading: a dropdown SETS a block type, it doesn't toggle one.
    // toggleHeading un-sets the heading when that level is already active, so picking
    // "Heading 1" on a block that was already H1 silently turned it back into a paragraph.
    if (value === 0) editor.chain().focus().setParagraph().run();
    else editor.chain().focus().setHeading({ level: value }).run();
    setOpen(false);
  }, [editor]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onReflow = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open]);

  return (
    <div className="heading-select">
      <button
        type="button"
        ref={triggerRef}
        className="heading-select__trigger"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Text style"
      >
        <span className="heading-select__value">{currentLabel}</span>
        <Icon name="expand_more" className={`heading-select__chevron${open ? ' is-open' : ''}`} />
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="heading-select__menu"
          role="listbox"
          aria-label="Text style"
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: Math.max(184, pos.width) }}
        >
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === currentLevel}
              data-level={o.value}
              className={`heading-select__option${o.value === currentLevel ? ' is-active' : ''}`}
              onClick={() => apply(o.value)}
            >
              <span className="heading-select__option-label">{o.label}</span>
              {o.value === currentLevel && <Icon name="check" className="heading-select__check" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default HeadingSelect;
