import { ZodError } from 'zod';

/**
 * Express middleware factory that validates req.body against a Zod schema.
 * Returns 400 with structured error messages on validation failure.
 *
 * Usage:
 *   router.post('/signup', validate(signupSchema), asyncHandler(signup));
 */
const validate = (schema) => (req, res, next) => {
    try {
        // Parse and replace req.body with validated/coerced data
        req.body = schema.parse(req.body);
        next();
    } catch (err) {
        if (err instanceof ZodError) {
            // Zod v4 exposes the failures as `issues`; `errors` was the v3 name and is now
            // undefined. Reading `.errors.map` threw a TypeError *inside this handler*, so every
            // invalid request fell through to the generic error middleware as a 500 —
            // callers saw "Something went wrong" instead of which field was wrong.
            const issues = err.issues ?? err.errors ?? [];
            const messages = issues.map(e => ({
                field: Array.isArray(e.path) ? e.path.join('.') : String(e.path ?? ''),
                message: e.message,
            }));
            return res.status(400).json({
                error: 'Validation failed',
                details: messages,
            });
        }
        next(err);
    }
};

export default validate;
