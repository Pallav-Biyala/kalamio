/**
 * Reading-time estimation for articles.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️  DUPLICATED FILE — keep byte-identical with:
 *         server/utils/read-time.js        (canonical: what gets published)
 *         frontend/src/common/read-time.js (the editor's live "min read")
 *
 *     The two builds share no package, but the writer's live estimate must match
 *     the number readers eventually see, so the algorithm lives in both trees.
 *     `server/utils/read-time.test.js` fails if the copies drift — edit both.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * We model reading as SECONDS of effort, then round once at the end. Words are
 * only part of the cost: images, code and embeds all take real time that a pure
 * word count scores as zero.
 */

// Adult English silent reading speed. Brysbaert (2019), a meta-analysis of 190
// studies / 18,573 participants: 238 wpm for NON-FICTION (260 for fiction).
// Articles are non-fiction, so 238 is the honest constant.
// https://doi.org/10.1016/j.jml.2019.104047
//
// (Medium uses 265 — a rounder, slightly optimistic product choice. We prefer the
// measured value; it is the difference between "2 min" and an inflated "3 min".)
const WPM_PROSE = 238;

// Code is not prose. Eye-tracking of program comprehension finds reading code is
// markedly less linear than natural text (~70% linear eye movements vs ~80%, and
// experts drop to ~60%) and needs far more fixations per area. We therefore charge
// code at roughly half prose speed. This is a reasoned estimate, not a measured
// constant — no study gives a clean "code wpm".
const WPM_CODE = 119;

// Chinese/Japanese have no whitespace word boundaries, so whitespace splitting
// scores a whole paragraph as ~1 word. We count characters instead. Reported silent
// rates cluster around 300–600 chars/min; 400 sits mid-range and is consistent with
// ~260 wpm at ~1.5 characters per word.
// NOTE: Korean is deliberately NOT treated this way — Hangul text is space-delimited,
// so it counts as words like any alphabetic language.
const CPM_CJK = 400;

// Medium's image rule, which is the de-facto standard and degrades sensibly for
// image-heavy posts: 12s for the first image, 11s for the second, minus a second
// each thereafter, floored at 3s (so every image from the 10th on costs 3s).
const IMAGE_FIRST_SECONDS = 12;
const IMAGE_MIN_SECONDS = 3;

// An embed (YouTube/tweet/gist) isn't "read" and we can't know its media duration,
// so it earns a small flat beat for the reader to register and decide on it.
const EMBED_SECONDS = 5;

// A file-attachment card is a glance: recognise the name, move on.
const ATTACHMENT_SECONDS = 3;

// Han + kana ranges (incl. CJK ext-A, compatibility ideographs, halfwidth katakana).
// Hangul is intentionally excluded — see CPM_CJK above.
const CJK_CHAR_RE = /[\u3040-\u309f\u30a0-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/g;
const HTML_TAG_RE = /<[^>]*>/g;

const emptyTally = () => ({
    proseWords: 0,
    codeWords: 0,
    cjkChars: 0,
    images: 0,
    embeds: 0,
    attachments: 0,
});

/**
 * Split a string into word + CJK-character counts.
 *
 * `stripHtml` is only for the legacy EditorJS format, which stores markup inside
 * its text fields. It must stay OFF for Tiptap, whose text nodes are already plain
 * text — stripping there would eat real content out of code blocks (a sample
 * containing `<div>` would silently lose it).
 */
const measure = (raw, stripHtml) => {
    if (typeof raw !== 'string' || !raw) return { words: 0, cjkChars: 0 };
    const text = stripHtml ? raw.replace(HTML_TAG_RE, ' ') : raw;
    const cjkChars = (text.match(CJK_CHAR_RE) || []).length;
    // Drop CJK before splitting so mixed text doesn't double-count.
    const words = text.replace(CJK_CHAR_RE, ' ').split(/\s+/).filter(Boolean).length;
    return { words, cjkChars };
};

const addProse = (tally, raw, stripHtml) => {
    const { words, cjkChars } = measure(raw, stripHtml);
    tally.proseWords += words;
    tally.cjkChars += cjkChars;
};

const addCode = (tally, raw, stripHtml) => {
    const { words, cjkChars } = measure(raw, stripHtml);
    tally.codeWords += words;
    tally.cjkChars += cjkChars;
};

/** Medium's decaying per-image cost. */
const imageSeconds = (count) => {
    let seconds = 0;
    for (let i = 0; i < count; i++) {
        seconds += Math.max(IMAGE_MIN_SECONDS, IMAGE_FIRST_SECONDS - i);
    }
    return seconds;
};

/**
 * Walk Tiptap JSON. Text lives in child `text` nodes for most nodes, but four
 * atoms carry reader-visible words in `attrs` only and are invisible to a
 * text-node-only walk: image (caption), mention (label), fileAttachment (filename).
 */
const walkTiptap = (nodes, tally, inCode) => {
    if (!Array.isArray(nodes)) return;

    for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const attrs = node.attrs || {};

        switch (node.type) {
            case 'text':
                if (inCode) addCode(tally, node.text, false);
                else addProse(tally, node.text, false);
                break;

            case 'image':
                tally.images += 1;
                // The <figcaption> is read; alt/title are a11y/tooltip only, so not counted.
                addProse(tally, attrs.caption, false);
                break;

            case 'mention':
                // Renders as "@label" — one word the text-node walk never sees.
                if (attrs.label || attrs.id) tally.proseWords += 1;
                break;

            case 'fileAttachment':
                tally.attachments += 1;
                addProse(tally, attrs.filename, false);
                break;

            case 'embed':
            case 'youtube':
                tally.embeds += 1;
                break;

            default:
                break;
        }

        if (node.content) {
            walkTiptap(node.content, tally, inCode || node.type === 'codeBlock');
        }
    }
};

/** Walk legacy EditorJS blocks. Its text fields contain HTML, so stripHtml is on. */
const walkEditorJs = (blocks, tally) => {
    if (!Array.isArray(blocks)) return;

    for (const block of blocks) {
        if (!block || typeof block !== 'object') continue;
        const data = block.data || {};

        if (block.type === 'image') tally.images += 1;
        if (block.type === 'embed') tally.embeds += 1;
        if (block.type === 'attaches') tally.attachments += 1;

        if (data.text) addProse(tally, data.text, true);
        if (data.caption) addProse(tally, data.caption, true);
        if (data.code) addCode(tally, data.code, true);

        // List items are plain strings on old blocks and { content } objects on
        // nested ones; checklist items use { text }.
        if (Array.isArray(data.items)) {
            for (const item of data.items) {
                if (typeof item === 'string') addProse(tally, item, true);
                else if (item && typeof item === 'object') addProse(tally, item.content || item.text, true);
            }
        }
    }
};

/**
 * Accept every shape `content` is stored or posted in:
 *   { type: 'doc', content: [...] }   Tiptap, as the editor POSTs it
 *   { blocks: [...] }                 legacy EditorJS
 *   [ <either of the above> ]         how Mongoose persists it (content: [Mixed])
 *
 * The array case matters: a draft loaded from the API comes back array-wrapped, and
 * the old code checked `content.type` / `content.blocks` on it — both undefined on an
 * array — silently scoring the entire body as zero words.
 */
const addContent = (content, tally) => {
    if (!content || typeof content !== 'object') return;

    if (Array.isArray(content)) {
        for (const entry of content) addContent(entry, tally);
        return;
    }
    if (content.type === 'doc') walkTiptap(content.content, tally, false);
    else if (Array.isArray(content.blocks)) walkEditorJs(content.blocks, tally);
};

/**
 * Full breakdown — exposed for tests and debugging.
 * @returns {{ minutes: number, seconds: number, tally: object }}
 */
export const analyzeReadTime = (content, title = '', des = '') => {
    const tally = emptyTally();

    // The title and subtitle sit above the body and are read on the way in.
    addProse(tally, title, true);
    addProse(tally, des, true);
    addContent(content, tally);

    const seconds =
        (tally.proseWords / WPM_PROSE) * 60 +
        (tally.codeWords / WPM_CODE) * 60 +
        (tally.cjkChars / CPM_CJK) * 60 +
        imageSeconds(tally.images) +
        tally.embeds * EMBED_SECONDS +
        tally.attachments * ATTACHMENT_SECONDS;

    // Round to NEAREST minute (the old code always ceil'd, so a 30-second post
    // advertised "1 min" and a 61-second one "2 min"). Floor of 1 keeps "0 min read"
    // off the page.
    return { minutes: Math.max(1, Math.round(seconds / 60)), seconds, tally };
};

/**
 * Estimated minutes to read an article.
 * @param {object|array} content Tiptap doc, legacy EditorJS, or either array-wrapped
 * @param {string} title
 * @param {string} des
 * @returns {number} whole minutes, always >= 1
 */
export const estimateReadTime = (content, title = '', des = '') =>
    analyzeReadTime(content, title, des).minutes;

export const READ_TIME_CONSTANTS = {
    WPM_PROSE,
    WPM_CODE,
    CPM_CJK,
    IMAGE_FIRST_SECONDS,
    IMAGE_MIN_SECONDS,
    EMBED_SECONDS,
    ATTACHMENT_SECONDS,
};
