import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeReadTime, estimateReadTime, READ_TIME_CONSTANTS } from './read-time.js';

const { WPM_PROSE, WPM_CODE, CPM_CJK } = READ_TIME_CONSTANTS;

// ── helpers ─────────────────────────────────────────────────────────────────
const words = (n, word = 'word') => Array.from({ length: n }, () => word).join(' ');
const para = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const doc = (...content) => ({ type: 'doc', content });
const codeBlock = (text) => ({ type: 'codeBlock', attrs: { language: 'js' }, content: [{ type: 'text', text }] });
const image = (caption = '') => ({ type: 'image', attrs: { src: 'https://x/i.png', caption } });

describe('read-time: prose', () => {
    it('reads exactly WPM_PROSE words in one minute', () => {
        const { seconds, minutes } = analyzeReadTime(doc(para(words(WPM_PROSE))));
        expect(seconds).toBeCloseTo(60, 5);
        expect(minutes).toBe(1);
    });

    it('scales linearly', () => {
        expect(estimateReadTime(doc(para(words(WPM_PROSE * 2))))).toBe(2);
        expect(estimateReadTime(doc(para(words(WPM_PROSE * 5))))).toBe(5);
    });

    it('rounds to NEAREST minute rather than always up', () => {
        // 185 words ≈ 47s. The old ceil(words/200) formula billed this as "2 min".
        expect(estimateReadTime(doc(para(words(185))))).toBe(1);
        // ~1h30m worth of over-half rounds up, not down.
        expect(estimateReadTime(doc(para(words(357))))).toBe(2); // 90s -> 1.5 -> 2
    });

    it('never returns less than 1 minute, even for empty/absent content', () => {
        expect(estimateReadTime(doc())).toBe(1);
        expect(estimateReadTime(null)).toBe(1);
        expect(estimateReadTime(undefined)).toBe(1);
        expect(estimateReadTime({})).toBe(1);
        expect(estimateReadTime('nonsense')).toBe(1);
        expect(estimateReadTime(doc(para('')))).toBe(1);
    });

    it('counts the title and subtitle, which are read on the way in', () => {
        const { tally } = analyzeReadTime(doc(), 'three word title', 'two words');
        expect(tally.proseWords).toBe(5);
    });

    it('counts text nested in lists, quotes, headings and table cells', () => {
        const nested = doc(
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'a b' }] },
            { type: 'blockquote', content: [para('c d')] },
            { type: 'bulletList', content: [{ type: 'listItem', content: [para('e f')] }] },
            {
                type: 'table',
                content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [para('g h')] }] }],
            },
        );
        expect(analyzeReadTime(nested).tally.proseWords).toBe(8);
    });
});

describe('read-time: images', () => {
    it("applies Medium's decay: 12s, 11s, 10s ...", () => {
        const sec = (n) => analyzeReadTime(doc(...Array.from({ length: n }, () => image()))).seconds;
        expect(sec(1)).toBeCloseTo(12, 5);
        expect(sec(2)).toBeCloseTo(23, 5); // 12 + 11
        expect(sec(3)).toBeCloseTo(33, 5); // 12 + 11 + 10
    });

    it('floors at 3s from the 10th image on', () => {
        const sec = (n) => analyzeReadTime(doc(...Array.from({ length: n }, () => image()))).seconds;
        expect(sec(10)).toBeCloseTo(75, 5); // 12+11+10+9+8+7+6+5+4+3
        expect(sec(11)).toBeCloseTo(78, 5); // +3, not +2
        expect(sec(12)).toBeCloseTo(81, 5); // +3
    });

    it('gives an image-only photo essay a real read time (regression: used to be 1 min)', () => {
        // 20 images, no prose. Old formula: ceil(0/200) -> 1 min.
        expect(estimateReadTime(doc(...Array.from({ length: 20 }, () => image())))).toBe(2);
    });

    it('counts the image caption, which the text-node-only walk missed', () => {
        const { tally } = analyzeReadTime(doc(image('a five word long caption')));
        expect(tally.proseWords).toBe(5);
        expect(tally.images).toBe(1);
    });

    it('ignores alt/title, which are not read as prose', () => {
        const withAlt = { type: 'image', attrs: { src: 's', caption: '', alt: 'ignored alt text', title: 'ignored title' } };
        expect(analyzeReadTime(doc(withAlt)).tally.proseWords).toBe(0);
    });
});

describe('read-time: code', () => {
    it('charges code at the slower code rate, not prose speed', () => {
        const { seconds, tally } = analyzeReadTime(doc(codeBlock(words(WPM_CODE))));
        expect(tally.codeWords).toBe(WPM_CODE);
        expect(tally.proseWords).toBe(0);
        expect(seconds).toBeCloseTo(60, 5);
    });

    it('takes longer than the same number of prose words', () => {
        const asCode = analyzeReadTime(doc(codeBlock(words(200)))).seconds;
        const asProse = analyzeReadTime(doc(para(words(200)))).seconds;
        expect(asCode).toBeGreaterThan(asProse);
    });

    it('does not strip HTML-looking text out of code samples', () => {
        // A Tiptap text node is already plain text; blanket tag-stripping would eat this.
        const { tally } = analyzeReadTime(doc(codeBlock('<div class="x">hello</div>')));
        expect(tally.codeWords).toBeGreaterThan(0);
    });
});

describe('read-time: embeds and attachments', () => {
    it('charges a flat beat per embed instead of zero', () => {
        const withEmbed = doc({ type: 'embed', attrs: { provider: 'youtube', url: 'u' } });
        expect(analyzeReadTime(withEmbed).seconds).toBeCloseTo(READ_TIME_CONSTANTS.EMBED_SECONDS, 5);

        const withYoutube = doc({ type: 'youtube', attrs: { src: 'u' } });
        expect(analyzeReadTime(withYoutube).tally.embeds).toBe(1);
    });

    it('counts a file attachment and its visible filename', () => {
        const withFile = doc({ type: 'fileAttachment', attrs: { url: 'u', filename: 'quarterly report.pdf' } });
        const { tally } = analyzeReadTime(withFile);
        expect(tally.attachments).toBe(1);
        expect(tally.proseWords).toBe(2);
    });

    it('counts a mention as the one word it renders as', () => {
        const withMention = doc({
            type: 'paragraph',
            content: [{ type: 'mention', attrs: { id: '1', label: 'harish' } }],
        });
        expect(analyzeReadTime(withMention).tally.proseWords).toBe(1);
    });
});

describe('read-time: CJK', () => {
    it('counts Chinese/Japanese by character, not whitespace', () => {
        // Whitespace splitting would score this entire run as 1 "word".
        const cjk = '你'.repeat(CPM_CJK);
        const { seconds, tally } = analyzeReadTime(doc(para(cjk)));
        expect(tally.cjkChars).toBe(CPM_CJK);
        expect(seconds).toBeCloseTo(60, 5);
    });

    it('handles text mixing CJK and latin without double counting', () => {
        const { tally } = analyzeReadTime(doc(para('hello 世界 world')));
        expect(tally.cjkChars).toBe(2);
        expect(tally.proseWords).toBe(2); // hello, world
    });

    it('treats Korean as words, since Hangul is space-delimited', () => {
        const { tally } = analyzeReadTime(doc(para('안녕하세요 세계')));
        expect(tally.cjkChars).toBe(0);
        expect(tally.proseWords).toBe(2);
    });
});

describe('read-time: content shapes', () => {
    it('handles content array-wrapped the way Mongoose persists it', () => {
        // content: [Mixed] means a stored doc comes back as [{type:'doc',...}]. The old
        // code checked .type/.blocks on the ARRAY -> both undefined -> whole body scored 0.
        const bare = doc(para(words(476)));
        expect(estimateReadTime(bare)).toBe(2);
        expect(estimateReadTime([bare])).toBe(2);
    });

    it('supports the legacy EditorJS format', () => {
        const legacy = {
            blocks: [
                { type: 'paragraph', data: { text: words(238) } },
                { type: 'image', data: { caption: 'two words' } },
            ],
        };
        const { tally } = analyzeReadTime(legacy);
        expect(tally.proseWords).toBe(240);
        expect(tally.images).toBe(1);
    });

    it('strips HTML from legacy EditorJS text, which stores markup inline', () => {
        const legacy = { blocks: [{ type: 'paragraph', data: { text: '<b>two</b> words' } }] };
        expect(analyzeReadTime(legacy).tally.proseWords).toBe(2);
    });

    it('handles legacy list items as both strings and objects', () => {
        const legacy = {
            blocks: [
                { type: 'list', data: { items: ['one two', { content: 'three four' }] } },
            ],
        };
        expect(analyzeReadTime(legacy).tally.proseWords).toBe(4);
    });

    it('is defensive about malformed nodes', () => {
        const junk = { type: 'doc', content: [null, 'str', 42, { type: 'text' }, { type: 'paragraph' }] };
        expect(() => estimateReadTime(junk)).not.toThrow();
        expect(estimateReadTime(junk)).toBe(1);
    });
});

describe('read-time: realistic articles', () => {
    it('scores a long-form technical post sensibly', () => {
        const article = doc(
            para(words(1200)),
            codeBlock(words(150)),
            para(words(800)),
            image('a caption'),
            image('another caption'),
        );
        // 2000 prose/238*60 = 504s, 150 code/119*60 = 76s, images 12+11 = 23s, captions ~4 words.
        const { minutes } = analyzeReadTime(article, 'A Technical Post', 'How it works');
        expect(minutes).toBe(10);
    });

    it('does not inflate a short post the way the old formula did', () => {
        // The real "Exploring the Quiet Beauty of Rural America": 185 words, stored as 2 min.
        const { minutes } = analyzeReadTime(doc(para(words(185))), 'Exploring the Quiet Beauty of Rural America', '');
        expect(minutes).toBe(1);
    });
});

describe('read-time: duplicated copy stays in sync', () => {
    it('is byte-identical to frontend/src/common/read-time.js', () => {
        const here = path.dirname(fileURLToPath(import.meta.url));
        const serverCopy = path.join(here, 'read-time.js');
        const frontendCopy = path.join(here, '..', '..', 'frontend', 'src', 'common', 'read-time.js');

        // The frontend tree isn't present in the API's Docker build context; skip there.
        if (!fs.existsSync(frontendCopy)) return;

        expect(fs.readFileSync(frontendCopy, 'utf8')).toBe(fs.readFileSync(serverCopy, 'utf8'));
    });
});
