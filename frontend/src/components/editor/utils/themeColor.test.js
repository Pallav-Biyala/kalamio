import { describe, it, expect } from 'vitest';
import { generateJSON } from '@tiptap/html';
import { isThemeText } from './themeColor';
import getExtensions from '../extensions/index';

// ── Unit: the black/white detector ────────────────────────────────────────────
describe('isThemeText', () => {
  it('flags pure black/white in every common notation', () => {
    for (const c of [
      'rgb(0, 0, 0)', 'rgb(0,0,0)', 'rgba(0,0,0,1)', 'rgb(0 0 0)',
      '#000', '#000000', 'black', 'BLACK', ' black ',
      'rgb(255, 255, 255)', '#fff', '#ffffff', 'white', 'rgba(255,255,255,0.9)',
    ]) {
      expect(isThemeText(c), c).toBe(true);
    }
  });

  it('flags near-black / near-white greys (Word/Windows paste artefacts) and system keywords', () => {
    for (const c of ['#0d0d0d', '#1a1a1a', '#212121', 'rgb(20,20,20)', '#f2f2f2', '#e8e8e8', 'windowtext', 'currentColor']) {
      expect(isThemeText(c), c).toBe(true);
    }
  });

  it('KEEPS genuine colours (saturated, or mid greys a writer might mean)', () => {
    for (const c of [
      'rgb(255, 0, 0)', 'red', '#e11d48', 'rgb(59, 130, 246)', // brand-ish
      '#800000', 'rgb(0, 26, 0)',                              // dark but saturated
      '#666666', 'rgb(120,120,120)', '#333333',                // mid greys ≠ black
      'rgb(200, 60, 60)',
    ]) {
      expect(isThemeText(c), c).toBe(false);
    }
  });

  it('is null/garbage safe', () => {
    for (const c of [null, undefined, '', '   ', 'notacolor', 'linear-gradient(...)']) {
      expect(isThemeText(c)).toBe(false);
    }
  });
});

// ── Integration: parse pasted-like HTML through the REAL editor extensions ─────
// generateJSON runs the same ProseMirror clipboard parse a paste does (jsdom), so this exercises
// ThemeAwareColor.parseHTML end-to-end — the actual fix path, not just the helper.
describe('ThemeAwareColor via the editor extension stack (paste parse)', () => {
  const colorOf = (html) => {
    const doc = generateJSON(html, getExtensions());
    const marks = doc.content?.[0]?.content?.[0]?.marks || [];
    const ts = marks.find((m) => m.type === 'textStyle');
    return ts?.attrs?.color ?? null; // null = no pinned colour → follows theme
  };

  it('drops a pasted black colour so the text follows the theme', () => {
    expect(colorOf('<p><span style="color: rgb(0, 0, 0)">hi</span></p>')).toBeNull();
    expect(colorOf('<p><span style="color:#000000">hi</span></p>')).toBeNull();
    expect(colorOf('<p><span style="color: black">hi</span></p>')).toBeNull();
  });

  it('drops a pasted white colour too', () => {
    expect(colorOf('<p><span style="color: rgb(255, 255, 255)">hi</span></p>')).toBeNull();
  });

  it('keeps a pasted real colour (red)', () => {
    expect(colorOf('<p><span style="color: rgb(255, 0, 0)">hi</span></p>')).toBe('rgb(255, 0, 0)');
  });
});
