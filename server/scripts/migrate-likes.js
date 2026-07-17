/**
 * Backfill the `likes` collection from the legacy "a like IS a notification" model.
 *
 * Likes used to be stored as notification documents (type "like" for posts, "comment_like" for
 * comments). They are now their own records — so WITHOUT THIS MIGRATION every existing like
 * disappears the moment the new code ships: hearts empty out, while `activity.total_likes` keeps
 * counting them.
 *
 * Safe to re-run: it upserts on the same unique (user, blog) / (user, comment) keys the schema
 * enforces, so a second run inserts nothing.
 *
 * Dry run (default) — reports what WOULD be created, writes nothing:
 *     node scripts/migrate-likes.js
 *
 * Apply:
 *     node scripts/migrate-likes.js --apply
 *
 * Requires DB_LOCATION in the environment (same var the server uses).
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Notification from '../Schema/Notification.js';
import Like from '../Schema/Like.js';

const APPLY = process.argv.includes('--apply');
const BATCH = 1000;

const migrate = async ({ type, field, label }) => {
    const filter = { type };
    const total = await Notification.countDocuments(filter);
    console.log(`\n${label}: ${total} legacy notification(s) to convert`);
    if (!total) return { total: 0, written: 0 };

    const cursor = Notification.find(filter, { user: 1, [field]: 1 }).lean().cursor();
    let ops = [];
    let written = 0;
    let skipped = 0;

    const flush = async () => {
        if (!ops.length) return;
        if (APPLY) {
            const res = await Like.bulkWrite(ops, { ordered: false });
            written += (res.upsertedCount ?? 0);
        } else {
            written += ops.length; // dry run: report candidates
        }
        ops = [];
    };

    for await (const n of cursor) {
        if (!n.user || !n[field]) { skipped++; continue; } // malformed legacy row
        ops.push({
            updateOne: {
                filter: { user: n.user, [field]: n[field] },
                update: { $setOnInsert: { user: n.user, [field]: n[field] } },
                upsert: true,
            },
        });
        if (ops.length >= BATCH) await flush();
    }
    await flush();

    console.log(`  ${APPLY ? 'created' : 'would create'}: ${written}${skipped ? ` | skipped malformed: ${skipped}` : ''}`);
    return { total, written };
};

const main = async () => {
    if (!process.env.DB_LOCATION) {
        console.error('DB_LOCATION is not set — refusing to run.');
        process.exit(1);
    }

    await mongoose.connect(process.env.DB_LOCATION);
    console.log(`Connected. Mode: ${APPLY ? 'APPLY (will write)' : 'DRY RUN (no writes)'}`);
    console.log(`Existing likes already in the new collection: ${await Like.countDocuments()}`);

    await migrate({ type: 'like', field: 'blog', label: 'POST likes' });
    await migrate({ type: 'comment_like', field: 'comment', label: 'COMMENT likes' });

    if (APPLY) {
        // Build the unique indexes now rather than lazily on first write.
        await Like.syncIndexes();
        console.log(`\nIndexes synced. Likes now stored: ${await Like.countDocuments()}`);
        console.log('\nNOTE: the legacy type:"like" / "comment_like" notifications are intentionally');
        console.log('LEFT IN PLACE — they are still the author\'s Activity feed items. Only the');
        console.log('like STATE moved. Nothing needs deleting.');
    } else {
        console.log('\nDry run — nothing written. Re-run with --apply to migrate.');
    }

    await mongoose.connection.close();
};

main().catch(async (err) => {
    console.error(err);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
});
