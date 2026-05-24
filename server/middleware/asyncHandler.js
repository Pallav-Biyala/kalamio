/**
 * Wraps an async route handler to catch errors and pass them to Express error handler.
 * Without this, unhandled promise rejections in async handlers crash the process (Express 4).
 *
 * Usage:
 *   router.get('/users', asyncHandler(async (req, res) => { ... }));
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
