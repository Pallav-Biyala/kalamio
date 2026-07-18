/**
 * Detect a text colour that should follow the platform's light/dark theme rather than being
 * pinned to a fixed value.
 *
 * Why this exists: the editor has no text-colour picker, so the ONLY way a `textStyle` colour
 * mark enters content is by pasting from Notepad/Word/a browser — and those sources stamp the
 * copied text with a hardcoded colour (`rgb(0,0,0)`, `black`, `windowtext`, `#ffffff`, …). Pinned
 * black text then stays black on the dark editor/reader (invisible), and pinned white stays white
 * on the light theme. The platform's real text colour is the `--c-black` CSS var (light on dark,
 * dark on light), so the fix is to DROP these achromatic near-black / near-white colours and let
 * the text inherit that var. Genuine (saturated) colours a writer pasted on purpose are kept.
 *
 * @param {string|null|undefined} color - a CSS colour string (rgb/rgba/hex/keyword)
 * @returns {boolean} true when the colour should be dropped so the text follows the theme
 */
export const isThemeText = (color) => {
  if (!color) return false;
  const c = String(color).trim().toLowerCase().replace(/['"]+/g, '');
  if (!c) return false;

  // Keywords that already mean "the default text colour" — dropping them is a no-op at worst.
  // `windowtext` is what MS Word/Windows rich text emits for ordinary black body text.
  if (c === 'windowtext' || c === 'currentcolor' || c === 'inherit' || c === 'initial') return true;

  const rgb = parseRgb(c);
  if (!rgb) return false; // unknown / named colour → assume intentional, keep it

  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min; // ~0 = grey; large = a saturated colour

  // A saturated colour (even a dark or pale one) is almost certainly intentional — keep it.
  if (chroma > 24) return false;

  // Achromatic and near one of the extremes → it's "black" or "white", follow the theme instead.
  return max <= 40 || min >= 216;
};

/**
 * Parse the CSS colour formats that actually reach this code into {r,g,b} (0–255), or null.
 * Paste/HTML load goes through the browser first, which normalises `element.style.color` to
 * `rgb(...)`/`rgba(...)`; stored content keeps whatever was saved (also rgb, occasionally hex).
 */
const parseRgb = (input) => {
  const c = input.trim();

  if (c === 'black') return { r: 0, g: 0, b: 0 };
  if (c === 'white') return { r: 255, g: 255, b: 255 };

  // rgb() / rgba() — comma-, space-, or slash-separated; alpha (if any) is ignored.
  const fn = c.match(/^rgba?\(([^)]+)\)$/);
  if (fn) {
    const [r, g, b] = fn[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if ([r, g, b].every((n) => Number.isFinite(n))) return { r, g, b };
    return null;
  }

  // #rgb / #rrggbb
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  return null;
};

export default isThemeText;
