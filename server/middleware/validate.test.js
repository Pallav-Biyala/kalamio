import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import validate from './validate.js';

const mockRes = () => {
    const res = {};
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    return res;
};

const schema = z.object({
    _id: z.string().min(1),
    isLikedByUser: z.boolean(),
});

describe('validate middleware', () => {
    it('passes a valid body through and calls next()', () => {
        const req = { body: { _id: 'abc', isLikedByUser: true } };
        const res = mockRes();
        const next = vi.fn();

        validate(schema)(req, res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(next).toHaveBeenCalledWith(); // no error argument
        expect(res.status).not.toHaveBeenCalled();
        expect(req.body).toEqual({ _id: 'abc', isLikedByUser: true });
    });

    it('rejects an invalid body with 400 and per-field details, not a 500', () => {
        // Regression: Zod v4 renamed ZodError.errors -> .issues. Reading `err.errors.map` threw a
        // TypeError INSIDE the error handler, so every invalid request fell through to the generic
        // error middleware as a 500 "Something went wrong" — hiding which field was actually wrong.
        // This is what the client sends when its like-status query hasn't resolved yet.
        const req = { body: { _id: 'abc' } }; // isLikedByUser missing
        const res = mockRes();
        const next = vi.fn();

        validate(schema)(req, res, next);

        expect(next).not.toHaveBeenCalled(); // must NOT fall through to the 500 handler
        expect(res.status).toHaveBeenCalledWith(400);

        const payload = res.json.mock.calls[0][0];
        expect(payload.error).toBe('Validation failed');
        expect(payload.details).toEqual([
            expect.objectContaining({ field: 'isLikedByUser' }),
        ]);
        expect(payload.details[0].message).toBeTruthy();
    });

    it('reports every failing field, with a dotted path for nested ones', () => {
        const nested = z.object({ outer: z.object({ inner: z.number() }), name: z.string() });
        const req = { body: { outer: { inner: 'nope' } } };
        const res = mockRes();

        validate(nested)(req, res, vi.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        const fields = res.json.mock.calls[0][0].details.map((d) => d.field);
        expect(fields).toContain('outer.inner');
        expect(fields).toContain('name');
    });

    it('coerces/strips to the parsed value so handlers see clean input', () => {
        const strict = z.object({ keep: z.string() });
        const req = { body: { keep: 'yes', dropMe: 'extra' } };
        const next = vi.fn();

        validate(strict)(req, mockRes(), next);

        expect(next).toHaveBeenCalledOnce();
        expect(req.body).toEqual({ keep: 'yes' }); // unknown key stripped by zod
    });

    it('forwards non-Zod errors to the error handler', () => {
        const exploding = { parse: () => { throw new Error('boom'); } };
        const res = mockRes();
        const next = vi.fn();

        validate(exploding)({ body: {} }, res, next);

        expect(res.status).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
});
