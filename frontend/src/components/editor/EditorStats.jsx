import { useEffect, useState, useCallback, useRef } from 'react';
import { estimateReadTime } from '../../common/read-time';

const EditorStats = ({ editor, className = 'editor-stats' }) => {
  const [stats, setStats] = useState({ words: 0, chars: 0, readingTime: 1 });
  const readTimeTimer = useRef(null);

  const updateCounts = useCallback(() => {
    if (!editor) return;
    try {
      const chars = editor.storage.characterCount?.characters() ?? 0;
      const words = editor.storage.characterCount?.words() ?? 0;
      setStats(prev => ({ ...prev, words, chars }));
    } catch {
      // Extension may not be ready yet
    }
  }, [editor]);

  // Read time comes from the same module the server publishes with, so the number
  // the writer sees here is the number readers get — a plain words/200 estimate
  // would disagree with it (it can't see images, code weighting or captions).
  // It walks the whole doc, so it's debounced instead of running per keystroke.
  const scheduleReadTime = useCallback(() => {
    if (!editor) return;
    clearTimeout(readTimeTimer.current);
    readTimeTimer.current = setTimeout(() => {
      try {
        setStats(prev => ({ ...prev, readingTime: estimateReadTime(editor.getJSON()) }));
      } catch {
        // Editor may have been torn down before the timer fired
      }
    }, 250);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    updateCounts();
    scheduleReadTime();

    const onUpdate = () => {
      updateCounts();
      scheduleReadTime();
    };

    editor.on('update', onUpdate);
    // Selection changes can't alter word count or read time, but the character-count
    // storage is only guaranteed fresh after a tick — keep the cheap re-read.
    editor.on('selectionUpdate', updateCounts);

    return () => {
      clearTimeout(readTimeTimer.current);
      editor.off('update', onUpdate);
      editor.off('selectionUpdate', updateCounts);
    };
  }, [editor, updateCounts, scheduleReadTime]);

  if (!editor) return null;

  const { words, chars, readingTime } = stats;

  return (
    <div className={className}>
      <span>{words} {words === 1 ? 'word' : 'words'}</span>
      <span className="editor-stats__dot">·</span>
      <span>{readingTime} min read</span>
      <span className="editor-stats__dot">·</span>
      <span>{chars} {chars === 1 ? 'character' : 'characters'}</span>
    </div>
  );
};

export default EditorStats;
