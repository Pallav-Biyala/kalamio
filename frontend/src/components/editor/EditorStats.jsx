import { useEffect, useState, useCallback } from 'react';

const EditorStats = ({ editor, className = 'editor-stats' }) => {
  const [stats, setStats] = useState({ words: 0, chars: 0 });

  const updateStats = useCallback(() => {
    if (!editor) return;
    try {
      const chars = editor.storage.characterCount?.characters() ?? 0;
      const words = editor.storage.characterCount?.words() ?? 0;
      setStats({ words, chars });
    } catch {
      // Extension may not be ready yet
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    // Initial count
    updateStats();

    // Subscribe to content changes
    editor.on('update', updateStats);
    editor.on('selectionUpdate', updateStats);

    return () => {
      editor.off('update', updateStats);
      editor.off('selectionUpdate', updateStats);
    };
  }, [editor, updateStats]);

  if (!editor) return null;

  const { words, chars } = stats;
  const readingTime = Math.max(1, Math.ceil(words / 200));

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
