/**
 * Backfill readTime for existing articles.
 *
 * readTime is only written on create/update, so posts published before a change to
 * the estimator keep whatever their old formula produced. This recomputes every
 * article with the current estimator.
 *
 * Dry run (default) — prints what WOULD change, writes nothing:
 *     node scripts/backfill-read-time.js
 *
 * Apply:
 *     node scripts/backfill-read-time.js --apply
 *
 * Requires DB_LOCATION in the environment (same var the server uses).
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Blog from '../Schema/Blog.js';
import { estimateReadTime } from '../utils/read-time.js';

const APPLY = process.argv.includes('--apply');

const main = async () => {
    if (!process.env.DB_LOCATION) {
        console.error('DB_LOCATION is not set — refusing to run.');
        process.exit(1);
    }

    await mongoose.connect(process.env.DB_LOCATION);
    console.log(`Connected. Mode: ${APPLY ? 'APPLY (will write)' : 'DRY RUN (no writes)'}\n`);

    const cursor = Blog.find({}, { blog_id: 1, title: 1, des: 1, content: 1, readTime: 1 }).lean().cursor();

    const ops = [];
    let scanned = 0;
    let changed = 0;
    const deltas = new Map();

    for await (const blog of cursor) {
        scanned++;
        const next = estimateReadTime(blog.content, blog.title, blog.des);
        const prev = blog.readTime;
        if (next === prev) continue;

        changed++;
        const key = `${prev ?? 'unset'} -> ${next}`;
        deltas.set(key, (deltas.get(key) || 0) + 1);
        if (changed <= 25) {
            console.log(`  ${String(prev ?? '-').padStart(3)} -> ${String(next).padEnd(3)} ${(blog.title || '').slice(0, 60)}`);
        }
        ops.push({ updateOne: { filter: { _id: blog._id }, update: { $set: { readTime: next } } } });
    }

    if (changed > 25) console.log(`  ... and ${changed - 25} more`);

    console.log(`\nScanned ${scanned} articles; ${changed} would change.`);
    if (deltas.size) {
        console.log('\nDistribution:');
        [...deltas.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${k.padEnd(12)} ${n}`));
    }

    if (APPLY && ops.length) {
        const res = await Blog.bulkWrite(ops, { ordered: false });
        console.log(`\nApplied. Modified: ${res.modifiedCount}`);
    } else if (!APPLY && ops.length) {
        console.log('\nDry run — nothing written. Re-run with --apply to write.');
    }

    await mongoose.connection.close();
};

main().catch(async (err) => {
    console.error(err);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
});
