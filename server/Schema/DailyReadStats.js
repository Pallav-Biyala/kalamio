import mongoose, { Schema } from "mongoose";

const dailyReadStatsSchema = new mongoose.Schema({
    blog: {
        type: Schema.Types.ObjectId,
        ref: 'blogs',
        required: true,
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'users',
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    reads: {
        type: Number,
        default: 0,
    },
});

// Compound unique index for upsert: one doc per blog per day
dailyReadStatsSchema.index({ blog: 1, date: 1 }, { unique: true });

// Query by author + date range for analytics dashboards
dailyReadStatsSchema.index({ author: 1, date: -1 });

const DailyReadStats = mongoose.model("daily_read_stats", dailyReadStatsSchema);

export default DailyReadStats;
