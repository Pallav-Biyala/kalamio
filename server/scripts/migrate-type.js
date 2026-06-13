/**
 * One-time migration: Update type 'article' → 'blog' for discriminator support.
 * 
 * Run: node scripts/migrate-type.js
 */
import mongoose from 'mongoose';
import 'dotenv/config';

const DB_URI = process.env.DB_LOCATION;

if (!DB_URI) {
    console.error('❌ DB_LOCATION not set in .env');
    process.exit(1);
}

async function migrate() {
    try {
        await mongoose.connect(DB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('blogs');

        // 1. Update type: 'article' → 'blog'
        const result1 = await collection.updateMany(
            { type: 'article' },
            { $set: { type: 'blog' } }
        );
        console.log(`✅ Updated ${result1.modifiedCount} documents: type 'article' → 'blog'`);

        // 2. Set type: 'blog' for any docs without a type field
        const result2 = await collection.updateMany(
            { type: { $exists: false } },
            { $set: { type: 'blog' } }
        );
        console.log(`✅ Updated ${result2.modifiedCount} documents: missing type → 'blog'`);

        // 3. Verify
        const blogCount = await collection.countDocuments({ type: 'blog' });
        const textPostCount = await collection.countDocuments({ type: 'text_post' });
        const otherCount = await collection.countDocuments({ type: { $nin: ['blog', 'text_post'] } });
        console.log(`\n📊 Final counts:`);
        console.log(`   Blogs: ${blogCount}`);
        console.log(`   Text Posts: ${textPostCount}`);
        console.log(`   Other: ${otherCount}`);

        if (otherCount > 0) {
            console.warn('⚠️  Some documents have unexpected type values!');
        }

        console.log('\n✅ Migration complete!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

migrate();
