import { useSeo } from "./useSeo";

/**
 * Backward-compatible wrapper around {@link useSeo}.
 *
 * Existing callers pass just a title; they now also get a canonical link plus
 * Open Graph / Twitter Card defaults for free. Pass `{ noindex: true }` for
 * private/app routes, or migrate to `useSeo` directly for rich per-page meta.
 *
 * @param {string} title
 * @param {{ noindex?: boolean, description?: string }} [options]
 */
const usePageTitle = (title, options = {}) => {
  useSeo({ title, ...options });
};

export default usePageTitle;
