/**
 * One-off backfill: stamp Cache-Control onto every EXISTING object in the S3 bucket.
 *
 * Why: images uploaded before Cache-Control was added to the presigned upload
 * (config/s3.js) have no cache headers, so browsers revalidate them against S3 on
 * every view (a round-trip → the visible "reload delay"). Filenames are unique per
 * upload, so the bytes at a URL never change → it's safe to cache them immutably.
 *
 * This copies each object onto itself with MetadataDirective=REPLACE to rewrite its
 * metadata (content is untouched).
 *
 * Usage — run from the server/ directory; it auto-loads server/.env (the same AWS
 * creds the app uses), so there's nothing to export:
 *   node scripts/backfill-s3-cache-control.js [flags]
 *
 * Flags:
 *   --dry-run      List what would change; write nothing.
 *   --limit=N      Only process the first N objects (use to test a handful first).
 *
 * ⚠️  Before running on everything: run with `--limit=2`, then open one of those
 *     image URLs in a browser to confirm it still loads publicly (see ACL note below),
 *     and re-check its headers show the new Cache-Control. Then run the full backfill.
 *
 * ACL note: this does NOT touch object ACLs. That's correct for buckets using
 * "Bucket owner enforced" ownership (ACLs disabled; public read via bucket policy) —
 * the modern default. If this bucket instead makes objects public via per-object
 * `public-read` ACLs, add `ACL: 'public-read'` to the CopyObjectCommand below, or the
 * copies will become private. The --limit test above will catch this.
 */
import 'dotenv/config'; // load server/.env (AWS_ACCESS_KEY, etc.) — must precede any process.env read
import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';

const BUCKET = process.env.AWS_BUCKET || 'blog-app-82817';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

if (!process.env.AWS_ACCESS_KEY || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('Missing AWS_ACCESS_KEY / AWS_SECRET_ACCESS_KEY in the environment.');
  process.exit(1);
}

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Preserve each object's Content-Type when we REPLACE its metadata (otherwise the
// copy would lose it). Inferred from the key's extension — no extra HeadObject call.
const CONTENT_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};
const contentTypeFor = (key) => CONTENT_TYPES[key.split('.').pop().toLowerCase()] || 'application/octet-stream';

let scanned = 0;
let updated = 0;
let failed = 0;

const run = async () => {
  console.log(`Bucket: ${BUCKET} (${REGION}) | Cache-Control: "${CACHE_CONTROL}"`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}${LIMIT !== Infinity ? ` | limit=${LIMIT}` : ''}\n`);

  let ContinuationToken;
  do {
    const list = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken }));

    for (const obj of list.Contents || []) {
      if (scanned >= LIMIT) break;
      scanned++;
      const Key = obj.Key;
      const ContentType = contentTypeFor(Key);

      if (DRY_RUN) {
        console.log(`would update: ${Key}  (${ContentType})`);
        continue;
      }

      try {
        await s3.send(new CopyObjectCommand({
          Bucket: BUCKET,
          Key,
          CopySource: `${BUCKET}/${encodeURIComponent(Key)}`,
          MetadataDirective: 'REPLACE',
          CacheControl: CACHE_CONTROL,
          ContentType,
          ServerSideEncryption: 'AES256', // preserve the SSE-S3 encryption the objects already use
        }));
        updated++;
        if (updated % 50 === 0) console.log(`… ${updated} updated`);
      } catch (err) {
        failed++;
        console.error(`✗ ${Key}: ${err.message}`);
      }
    }

    ContinuationToken = list.IsTruncated && scanned < LIMIT ? list.NextContinuationToken : undefined;
  } while (ContinuationToken);

  console.log(`\nDone. scanned=${scanned} updated=${updated} failed=${failed}${DRY_RUN ? ' (dry run — nothing written)' : ''}`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
