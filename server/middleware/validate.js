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
            const messages = err.errors.map(e => ({
                field: e.path.join('.'),
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
