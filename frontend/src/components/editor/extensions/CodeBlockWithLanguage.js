import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { ReactNodeViewRenderer } from '@tiptap/react';
import CodeBlockNodeView from '../views/CodeBlockNodeView';

/**
 * CodeBlockWithLanguage — Extends CodeBlockLowlight to use a custom
 * React NodeView that includes a language selector dropdown.
 *
 * All syntax-highlighting behaviour from CodeBlockLowlight is preserved;
 * only the rendering layer is swapped to the custom NodeView.
 */
const CodeBlockWithLanguage = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },
});

export default CodeBlockWithLanguage;
