import { useEffect, useRef, useState, useCallback } from 'react';
import { TextSelection } from '@tiptap/pm/state';
import Icon from '../Icon';

/**
 * BlockHandle — Floating block-level controls in the left gutter.
 * Appears when hovering over top-level blocks in the editor.
 * Provides: move up, drag to reorder, move down, delete.
 */
const BlockHandle = ({ editor }) => {
  const handleRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [top, setTop] = useState(0);
  const activeBlockRef = useRef(null);
  const hideTimerRef = useRef(null);
  const isOverHandleRef = useRef(false);
  const isDraggingRef = useRef(false);

  // Find the top-level block DOM node from any target
  const findTopLevelBlock = useCallback((target) => {
    if (!editor?.view?.dom) return null;
    const pmDom = editor.view.dom;
    let el = target;

    while (el && el.parentElement !== pmDom) {
      el = el.parentElement;
    }

    if (!el || el === pmDom) return null;
    return el;
  }, [editor]);

  const showForBlock = useCallback((blockDom) => {
    if (!handleRef.current || !editor?.view?.dom) return;

    const wrapperEl = handleRef.current.parentElement;
    if (!wrapperEl) return;

    const wrapperRect = wrapperEl.getBoundingClientRect();
    const blockRect = blockDom.getBoundingClientRect();

    setTop(blockRect.top - wrapperRect.top);
    setVisible(true);
    activeBlockRef.current = blockDom;
  }, [editor]);

  const scheduleHide = useCallback(() => {
    if (isDraggingRef.current) return;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!isOverHandleRef.current && !isDraggingRef.current) {
        setVisible(false);
        activeBlockRef.current = null;
      }
    }, 300);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    isOverHandleRef.current = true;
    cancelHide();
  }, [cancelHide]);

  const handleMouseLeave = useCallback(() => {
    isOverHandleRef.current = false;
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    if (!editor?.view?.dom) return;

    const pmDom = editor.view.dom;

    const onMouseMove = (e) => {
      if (isDraggingRef.current) return;
      const blockDom = findTopLevelBlock(e.target);
      if (blockDom && blockDom !== activeBlockRef.current) {
        cancelHide();
        showForBlock(blockDom);
      }
    };

    const onMouseLeave = () => {
      scheduleHide();
    };

    pmDom.addEventListener('mousemove', onMouseMove);
    pmDom.addEventListener('mouseleave', onMouseLeave);

    return () => {
      pmDom.removeEventListener('mousemove', onMouseMove);
      pmDom.removeEventListener('mouseleave', onMouseLeave);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [editor, findTopLevelBlock, showForBlock, scheduleHide, cancelHide]);

  // Get the ProseMirror position range [from, to] for the active block
  const getBlockRange = useCallback(() => {
    if (!editor || !activeBlockRef.current) return null;

    try {
      const pmDom = editor.view.dom;
      const children = Array.from(pmDom.children);
      const index = children.indexOf(activeBlockRef.current);
      if (index < 0) return null;

      const doc = editor.state.doc;
      let pos = 0;
      for (let i = 0; i < doc.childCount; i++) {
        const child = doc.child(i);
        if (i === index) {
          return { from: pos, to: pos + child.nodeSize, index: i };
        }
        pos += child.nodeSize;
      }
    } catch {
      // Position may be stale
    }
    return null;
  }, [editor]);

  // ── Drag-and-drop ──────────────────────────────────────────
  const handleDragStart = useCallback((e) => {
    if (!editor || !activeBlockRef.current) {
      e.preventDefault();
      return;
    }

    const range = getBlockRange();
    if (!range) {
      e.preventDefault();
      return;
    }

    isDraggingRef.current = true;

    const { from, to } = range;
    const slice = editor.state.doc.slice(from, to);

    // Tell ProseMirror this is an internal move drag
    editor.view.dragging = { slice, move: true };

    // Set the selection to the block being dragged
    const { tr } = editor.state;
    tr.setSelection(TextSelection.create(editor.state.doc, from, to));
    editor.view.dispatch(tr);

    // Set drag image to the block element
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setDragImage(activeBlockRef.current, 0, 0);
    e.dataTransfer.setData('text/plain', activeBlockRef.current.textContent || '');
  }, [editor, getBlockRange]);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    setVisible(false);
  }, []);

  // ── Move up / down / delete ────────────────────────────────
  const handleMoveUp = useCallback(() => {
    const range = getBlockRange();
    if (!range || !editor || range.index === 0) return;

    try {
      const doc = editor.state.doc;
      const prevNode = doc.child(range.index - 1);
      const thisNode = doc.child(range.index);

      let prevStart = 0;
      for (let i = 0; i < range.index - 1; i++) {
        prevStart += doc.child(i).nodeSize;
      }
      const thisStart = prevStart + prevNode.nodeSize;
      const thisEnd = thisStart + thisNode.nodeSize;

      const { tr } = editor.state;
      const slice = editor.state.doc.slice(thisStart, thisEnd);
      tr.delete(thisStart, thisEnd);
      tr.insert(prevStart, slice.content);
      editor.view.dispatch(tr);
      editor.commands.focus();
    } catch { /* ignore */ }
    setVisible(false);
  }, [editor, getBlockRange]);

  const handleMoveDown = useCallback(() => {
    const range = getBlockRange();
    if (!range || !editor) return;

    const doc = editor.state.doc;
    if (range.index >= doc.childCount - 1) return;

    try {
      const thisNode = doc.child(range.index);
      const nextNode = doc.child(range.index + 1);

      let thisStart = 0;
      for (let i = 0; i < range.index; i++) {
        thisStart += doc.child(i).nodeSize;
      }
      const thisEnd = thisStart + thisNode.nodeSize;
      const nextEnd = thisEnd + nextNode.nodeSize;

      const { tr } = editor.state;
      const slice = editor.state.doc.slice(thisEnd, nextEnd);
      tr.delete(thisEnd, nextEnd);
      tr.insert(thisStart, slice.content);
      editor.view.dispatch(tr);
      editor.commands.focus();
    } catch { /* ignore */ }
    setVisible(false);
  }, [editor, getBlockRange]);

  const handleDelete = useCallback(() => {
    const range = getBlockRange();
    if (!range || !editor) return;

    try {
      editor.chain().focus().deleteRange({ from: range.from, to: range.to }).run();
    } catch { /* ignore */ }
    setVisible(false);
  }, [editor, getBlockRange]);

  if (!editor) return null;

  return (
    <div
      ref={handleRef}
      className={`block-handle ${visible ? 'block-handle--visible' : ''}`}
      style={{ top: `${top}px` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className="block-handle__btn"
        onClick={handleMoveUp}
        title="Move up"
        aria-label="Move block up"
      >
        <Icon name="keyboard_arrow_up" className="text-sm" />
      </button>
      <div
        className="block-handle__grip"
        draggable="true"
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        title="Drag to reorder"
        aria-label="Drag to reorder"
      >
        <Icon name="drag_indicator" className="text-sm" />
      </div>
      <button
        type="button"
        className="block-handle__btn"
        onClick={handleMoveDown}
        title="Move down"
        aria-label="Move block down"
      >
        <Icon name="keyboard_arrow_down" className="text-sm" />
      </button>
      <button
        type="button"
        className="block-handle__btn block-handle__btn--delete"
        onClick={handleDelete}
        title="Delete block"
        aria-label="Delete block"
      >
        <Icon name="delete" className="text-sm" />
      </button>
    </div>
  );
};

export default BlockHandle;
