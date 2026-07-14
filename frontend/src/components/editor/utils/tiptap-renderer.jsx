import LazyEmbed from './LazyEmbed';
import { common, createLowlight } from 'lowlight';
import { toHtml } from 'hast-util-to-html';
import { cdnUrl } from '../../../common/cdn';

const lowlight = createLowlight(common);

const extractYouTubeId = (src) => {
    if (!src) return '';
    // Handle various YouTube URL formats
    const patterns = [
        /(?:youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^#&?/\s]{11})/,
        /(?:youtu\.be\/)([^#&?/\s]{11})/,
        /^([^#&?/\s]{11})$/, // bare ID
    ];
    for (const pattern of patterns) {
        const match = src.match(pattern);
        if (match) return match[1];
    }
    return src;
};

const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const renderMarks = (textNode) => {
    const { text, marks } = textNode;
    if (!marks || marks.length === 0) return text;

    return marks.reduce((content, mark) => {
        switch (mark.type) {
            case 'bold':
                return <strong>{content}</strong>;
            case 'italic':
                return <em>{content}</em>;
            case 'underline':
                return <u>{content}</u>;
            case 'strike':
                return <s>{content}</s>;
            case 'code':
                return <code className="inline-code">{content}</code>;
            case 'highlight': {
                const style = mark.attrs?.color ? { backgroundColor: mark.attrs.color } : undefined;
                return <mark style={style}>{content}</mark>;
            }
            case 'link':
                return (
                    <a href={mark.attrs?.href} target="_blank" rel="noopener noreferrer">
                        {content}
                    </a>
                );
            case 'textStyle': {
                if (mark.attrs?.color) {
                    return <span style={{ color: mark.attrs.color }}>{content}</span>;
                }
                return content;
            }
            default:
                return content;
        }
    }, text);
};

const renderNode = (node, index) => {
    if (!node) return null;

    switch (node.type) {
        case 'doc':
            return (
                <div key={index} className="tiptap-content">
                    {node.content?.map((child, i) => renderNode(child, i))}
                </div>
            );

        case 'paragraph': {
            const style = node.attrs?.textAlign ? { textAlign: node.attrs.textAlign } : undefined;
            return (
                <p key={index} style={style}>
                    {node.content?.map((child, i) => renderNode(child, i))}
                </p>
            );
        }

        case 'heading': {
            const level = node.attrs?.level || 2;
            const Tag = `h${Math.min(Math.max(level, 1), 6)}`;
            const style = node.attrs?.textAlign ? { textAlign: node.attrs.textAlign } : undefined;
            return (
                <Tag key={index} style={style}>
                    {node.content?.map((child, i) => renderNode(child, i))}
                </Tag>
            );
        }

        case 'text':
            return <span key={index}>{renderMarks(node)}</span>;

        case 'bulletList':
            return (
                <ul key={index}>
                    {node.content?.map((child, i) => renderNode(child, i))}
                </ul>
            );

        case 'orderedList': {
            const start = node.attrs?.start;
            return (
                <ol key={index} start={start && start !== 1 ? start : undefined}>
                    {node.content?.map((child, i) => renderNode(child, i))}
                </ol>
            );
        }

        case 'listItem':
            return (
                <li key={index}>
                    {node.content?.map((child, i) => renderNode(child, i))}
                </li>
            );

        case 'blockquote':
            return (
                <blockquote key={index} className="blog-blockquote">
                    {node.content?.map((child, i) => renderNode(child, i))}
                </blockquote>
            );

        case 'codeBlock': {
            const lang = node.attrs?.language || '';
            const code = node.content?.map(c => c.text || '').join('') || '';
            let highlightedHtml = '';

            try {
                if (lang && lowlight.registered(lang)) {
                    const tree = lowlight.highlight(lang, code);
                    highlightedHtml = toHtml(tree);
                } else if (lang) {
                    // Language not registered, try auto-detect
                    const tree = lowlight.highlightAuto(code);
                    highlightedHtml = toHtml(tree);
                } else {
                    const tree = lowlight.highlightAuto(code);
                    highlightedHtml = toHtml(tree);
                }
            } catch {
                // Fallback: render as plain text
                highlightedHtml = code
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
            }

            return (
                <pre key={index} className="code-block">
                    <code
                        className={lang ? `language-${lang}` : undefined}
                        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                    />
                </pre>
            );
        }

        case 'horizontalRule':
            return <hr key={index} />;

        case 'image': {
            const { src, alt, caption, title } = node.attrs || {};
            return (
                <figure key={index} className="blog-image">
                    <img src={cdnUrl(src)} alt={alt || title || ''} title={title || undefined} />
                    {caption && <figcaption>{caption}</figcaption>}
                </figure>
            );
        }

        case 'table':
            return (
                <div key={index} className="table-wrapper">
                    <table>
                        <tbody>
                            {node.content?.map((child, i) => renderNode(child, i))}
                        </tbody>
                    </table>
                </div>
            );

        case 'tableRow':
            return (
                <tr key={index}>
                    {node.content?.map((child, i) => renderNode(child, i))}
                </tr>
            );

        case 'tableCell': {
            const attrs = {};
            if (node.attrs?.colspan && node.attrs.colspan > 1) attrs.colSpan = node.attrs.colspan;
            if (node.attrs?.rowspan && node.attrs.rowspan > 1) attrs.rowSpan = node.attrs.rowspan;
            return (
                <td key={index} {...attrs}>
                    {node.content?.map((child, i) => renderNode(child, i))}
                </td>
            );
        }

        case 'tableHeader': {
            const attrs = {};
            if (node.attrs?.colspan && node.attrs.colspan > 1) attrs.colSpan = node.attrs.colspan;
            if (node.attrs?.rowspan && node.attrs.rowspan > 1) attrs.rowSpan = node.attrs.rowspan;
            return (
                <th key={index} {...attrs}>
                    {node.content?.map((child, i) => renderNode(child, i))}
                </th>
            );
        }

        case 'embed':
            return (
                <LazyEmbed
                    key={index}
                    provider={node.attrs?.provider}
                    url={node.attrs?.url}
                    embedId={node.attrs?.embedId}
                    metadata={node.attrs?.metadata}
                />
            );

        case 'youtube':
            return (
                <LazyEmbed
                    key={index}
                    provider="youtube"
                    url={node.attrs?.src}
                    embedId={extractYouTubeId(node.attrs?.src)}
                />
            );

        case 'fileAttachment': {
            const { url, filename, fileSize, mimeType } = node.attrs || {};
            const extension = filename?.split('.').pop()?.toUpperCase() || 'FILE';
            return (
                <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="file-download-card"
                >
                    <span style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '2.5rem', height: '2.5rem', background: '#f1f5f9',
                        borderRadius: '0.375rem', fontSize: '0.65rem', fontWeight: 700,
                        color: '#475569',
                    }}>
                        {extension}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {filename || 'Download file'}
                        </div>
                        {(fileSize || mimeType) && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                                {mimeType && <span>{mimeType}</span>}
                                {mimeType && fileSize ? ' · ' : ''}
                                {fileSize && <span>{formatFileSize(fileSize)}</span>}
                            </div>
                        )}
                    </div>
                    <span style={{ fontSize: '1.1rem', color: '#94a3b8' }}>↓</span>
                </a>
            );
        }

        case 'mention':
            return (
                <a key={index} href={`/user/${node.attrs?.id}`} className="mention">
                    @{node.attrs?.label}
                </a>
            );

        case 'hardBreak':
            return <br key={index} />;

        default:
            // Attempt to render children for unknown node types
            if (node.content) {
                return (
                    <div key={index}>
                        {node.content.map((child, i) => renderNode(child, i))}
                    </div>
                );
            }
            return null;
    }
};

const TiptapRenderer = ({ content }) => {
    if (!content) return null;

    // Accept both { type: 'doc', content: [...] } and raw content array
    if (content.type === 'doc') {
        return renderNode(content, 0);
    }

    // If content is an array of nodes (without wrapper doc), wrap them
    if (Array.isArray(content)) {
        return (
            <div className="tiptap-content">
                {content.map((node, i) => renderNode(node, i))}
            </div>
        );
    }

    return null;
};

export default TiptapRenderer;
