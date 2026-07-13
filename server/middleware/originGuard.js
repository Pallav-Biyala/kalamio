/**
 * Cloudflare-only origin guard.
 *
 * When CLOUDFLARE_ORIGIN_SECRET is set, Cloudflare is configured (via a Transform
 * Rule) to add `X-Origin-Secret: <secret>` to every request it forwards to the
 * origin. Requests without it — i.e. someone hitting the raw *.run.app URL
 * directly to bypass Cloudflare's WAF / DDoS protection — are refused.
 *
 * Opt-in: a transparent no-op until the env var is set, so nothing breaks before
 * Cloudflare is in front. Health checks and the Socket.IO path (already
 * JWT-authenticated) are always exempt so probes and realtime keep working.
 */
export const originGuard = (req, res, next) => {
  const secret = process.env.CLOUDFLARE_ORIGIN_SECRET;
  if (!secret) return next();
  if (req.path === '/health' || req.path.startsWith('/socket.io')) return next();
  if (req.get('x-origin-secret') === secret) return next();
  return res.status(403).json({ error: 'Forbidden' });
};

export default originGuard;
