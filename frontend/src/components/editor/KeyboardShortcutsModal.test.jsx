import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';

describe('KeyboardShortcutsModal', () => {
    it('renders the dialog and shortcut groups', () => {
        render(<KeyboardShortcutsModal onClose={vi.fn()} />);

        expect(
            screen.getByRole('dialog', { name: 'Keyboard Shortcuts' })
        ).toBeInTheDocument();

        expect(screen.getByText('Text formatting')).toBeInTheDocument();
        expect(screen.getByText('Blocks')).toBeInTheDocument();
        expect(screen.getByText('Links')).toBeInTheDocument();
        expect(screen.getByText('Editing')).toBeInTheDocument();

        expect(screen.getByText('Strikethrough')).toBeInTheDocument();
        expect(screen.getByText('Heading 1')).toBeInTheDocument();
        expect(screen.getByText('Numbered list')).toBeInTheDocument();
        expect(screen.getByText('Undo')).toBeInTheDocument();
    });

    it('moves focus to the close button when opened', () => {
        render(<KeyboardShortcutsModal onClose={vi.fn()} />);

        expect(
            screen.getByRole('button', { name: 'Close keyboard shortcuts' })
        ).toHaveFocus();
    });

    it('calls onClose when Escape is pressed', () => {
        const onClose = vi.fn();

        render(<KeyboardShortcutsModal onClose={onClose} />);
        fireEvent.keyDown(document, { key: 'Escape' });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('wraps focus from the last button to the first on Tab', () => {
        render(<KeyboardShortcutsModal onClose={vi.fn()} />);

        const closeButton = screen.getByRole('button', {
            name: 'Close keyboard shortcuts',
        });
        const doneButton = screen.getByRole('button', { name: 'Done' });

        doneButton.focus();
        fireEvent.keyDown(document, { key: 'Tab' });

        expect(closeButton).toHaveFocus();
    });

    it('wraps focus from the first button to the last on Shift+Tab', () => {
        render(<KeyboardShortcutsModal onClose={vi.fn()} />);

        const closeButton = screen.getByRole('button', {
            name: 'Close keyboard shortcuts',
        });
        const doneButton = screen.getByRole('button', { name: 'Done' });

        closeButton.focus();
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

        expect(doneButton).toHaveFocus();
    });

    it('restores focus to the previously focused element on unmount', () => {
        const trigger = document.createElement('button');
        trigger.textContent = 'Open keyboard shortcuts';
        document.body.appendChild(trigger);
        trigger.focus();

        const { unmount } = render(
            <KeyboardShortcutsModal onClose={vi.fn()} />
        );

        expect(
            screen.getByRole('button', { name: 'Close keyboard shortcuts' })
        ).toHaveFocus();

        unmount();

        expect(trigger).toHaveFocus();
        trigger.remove();
    });

    it('closes when the backdrop is pressed', () => {
        const onClose = vi.fn();
        const { container } = render(
            <KeyboardShortcutsModal onClose={onClose} />
        );

        fireEvent.mouseDown(container.firstElementChild);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when the dialog itself is pressed', () => {
        const onClose = vi.fn();

        render(<KeyboardShortcutsModal onClose={onClose} />);

        fireEvent.mouseDown(
            screen.getByRole('dialog', { name: 'Keyboard Shortcuts' })
        );

        expect(onClose).not.toHaveBeenCalled();
    });
});
