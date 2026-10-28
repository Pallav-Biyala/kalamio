import { memo, useEffect, useRef } from 'react';
import Icon from '../Icon';

const SHORTCUT_GROUPS = [
    {
        title: 'Text formatting',
        shortcuts: [
            { keys: ['Mod', 'B'], label: 'Bold' },
            { keys: ['Mod', 'I'], label: 'Italic' },
            { keys: ['Mod', 'Shift', 'S'], label: 'Strikethrough' },
            { keys: ['Mod', 'E'], label: 'Inline code' },
            { keys: ['Mod', 'U'], label: 'Underline' },
        ],
    },
    {
        title: 'Blocks',
        shortcuts: [
            { keys: ['Mod', 'Alt', '1'], label: 'Heading 1' },
            { keys: ['Mod', 'Alt', '2'], label: 'Heading 2' },
            { keys: ['Mod', 'Alt', '3'], label: 'Heading 3' },
            { keys: ['Mod', 'Shift', '7'], label: 'Numbered list' },
            { keys: ['Mod', 'Shift', '8'], label: 'Bullet list' },
            { keys: ['Mod', 'Shift', 'B'], label: 'Blockquote' },
        ],
    },
    {
        title: 'Links',
        shortcuts: [
            { keys: ['Mod', 'K'], label: 'Insert or edit link' },
        ],
    },
    {
        title: 'Editing',
        shortcuts: [
            { keys: ['Mod', 'Z'], label: 'Undo' },
            { keys: ['Mod', 'Shift', 'Z'], label: 'Redo' },
        ],
    },
];

const getPlatform = () => {
    if (typeof navigator === 'undefined') return 'other';

    return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)
        ? 'mac'
        : 'other';
};

const formatKey = (key, platform) => {
    if (key === 'Mod') return platform === 'mac' ? '⌘' : 'Ctrl';
    if (key === 'Alt') return platform === 'mac' ? '⌥' : 'Alt';
    if (key === 'Shift') return platform === 'mac' ? '⇧' : 'Shift';

    return key;
};

const KeyboardShortcutsModal = memo(({ onClose }) => {
    const closeButtonRef = useRef(null);
    const dialogRef = useRef(null);

    useEffect(() => {
        const previousFocus = document.activeElement;
        closeButtonRef.current?.focus();

        const getFocusableElements = () => {
            if (!dialogRef.current) return [];

            return Array.from(
                dialogRef.current.querySelectorAll(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
            );
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key !== 'Tab') return;

            const focusableElements = getFocusableElements();
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (!firstElement || !lastElement) {
                event.preventDefault();
                return;
            }

            if (
                event.shiftKey &&
                (document.activeElement === firstElement ||
                    !dialogRef.current.contains(document.activeElement))
            ) {
                event.preventDefault();
                lastElement.focus();
            } else if (
                !event.shiftKey &&
                (document.activeElement === lastElement ||
                    !dialogRef.current.contains(document.activeElement))
            ) {
                event.preventDefault();
                firstElement.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);

            if (
                previousFocus instanceof HTMLElement &&
                previousFocus.isConnected
            ) {
                previousFocus.focus();
            }
        };
    }, [onClose]);

    const platform = getPlatform();

    return (
        <div
            className="embed-modal-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <section
                ref={dialogRef}
                className="embed-modal keyboard-shortcuts-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="keyboard-shortcuts-title"
            >
                <header className="embed-modal__header">
                    <div className="embed-modal__header-left">
                        <Icon name="keyboard" className="text-xl" />
                        <h2
                            id="keyboard-shortcuts-title"
                            className="embed-modal__title"
                        >
                            Keyboard Shortcuts
                        </h2>
                    </div>

                    <button
                        ref={closeButtonRef}
                        type="button"
                        className="embed-modal__close"
                        onClick={onClose}
                        aria-label="Close keyboard shortcuts"
                    >
                        <Icon name="close" className="text-lg" />
                    </button>
                </header>

                <p className="embed-modal__subtitle">
                    Work faster with these keyboard shortcuts.
                </p>

                <div className="keyboard-shortcuts-modal__body">
                    {SHORTCUT_GROUPS.map((group) => (
                        <section
                            key={group.title}
                            className="keyboard-shortcuts-modal__group"
                        >
                            <h3 className="keyboard-shortcuts-modal__group-title">
                                {group.title}
                            </h3>

                            <dl className="keyboard-shortcuts-modal__list">
                                {group.shortcuts.map(({ keys, label }) => (
                                    <div
                                        key={label}
                                        className="keyboard-shortcuts-modal__row"
                                    >
                                        <dt>{label}</dt>
                                        <dd>
                                            {keys.map((key, index) => (
                                                <span key={`${key}-${index}`}>
                                                    {index > 0 && (
                                                        <span
                                                            className="keyboard-shortcuts-modal__plus"
                                                            aria-hidden="true"
                                                        >
                                                            +
                                                        </span>
                                                    )}
                                                    <kbd>
                                                        {formatKey(key, platform)}
                                                    </kbd>
                                                </span>
                                            ))}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    ))}
                </div>

                <footer className="embed-modal__footer">
                    <button
                        type="button"
                        className="text-dark-grey hover:text-black hover:bg-grey/80 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                        onClick={onClose}
                    >
                        Done
                    </button>
                </footer>
            </section>
        </div>
    );
});

KeyboardShortcutsModal.displayName = 'KeyboardShortcutsModal';

export default KeyboardShortcutsModal;
