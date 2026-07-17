import { memo, useCallback } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import toast from 'react-hot-toast';
import Icon from '../../Icon';

const LANGUAGES = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'jsx', label: 'JSX' },
  { value: 'tsx', label: 'TSX' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'shell', label: 'Shell' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'r', label: 'R' },
  { value: 'lua', label: 'Lua' },
  { value: 'perl', label: 'Perl' },
  { value: 'dart', label: 'Dart' },
  { value: 'elixir', label: 'Elixir' },
  { value: 'haskell', label: 'Haskell' },
  { value: 'scala', label: 'Scala' },
];

const CodeBlockNodeView = memo(({ node, updateAttributes, extension }) => {
  const currentLang = node.attrs.language || 'plaintext';

  const handleLanguageChange = useCallback(
    (e) => {
      updateAttributes({ language: e.target.value });
    },
    [updateAttributes]
  );

  const handleCopyCode = useCallback(() => {
    const codeText = node.textContent;
    navigator.clipboard.writeText(codeText).then(
      () => toast.success('Copied'),
      () => toast.error('Failed to copy.')
    );
  }, [node]);

  return (
    <NodeViewWrapper className="code-block-node-view">
      <div className="code-block-node-view__header">
        <select
          className="code-block-node-view__lang-select"
          value={currentLang}
          onChange={handleLanguageChange}
          contentEditable={false}
          aria-label="Code language"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="code-block-node-view__copy-btn"
          onClick={handleCopyCode}
          title="Copy code"
          aria-label="Copy code"
          contentEditable={false}
        >
          <Icon name="content_copy" className="text-sm" />
          <span>Copy</span>
        </button>
      </div>
      <pre className="code-block-node-view__pre">
        <NodeViewContent as="code" className={`language-${currentLang}`} />
      </pre>
    </NodeViewWrapper>
  );
});

CodeBlockNodeView.displayName = 'CodeBlockNodeView';

export default CodeBlockNodeView;
