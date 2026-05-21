import mongoose, { Schema } from "mongoose";

const subscriptionSchema = mongoose.Schema({
    subscriber: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'users'
    },
    publication: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'publications'
    }
},
{
    timestamps: {
        createdAt: 'subscribedAt',
        updatedAt: false
    }
});

// Unique — a user can only subscribe once to a publication
subscriptionSchema.index({ subscriber: 1, publication: 1 }, { unique: true });

// List all subscribers of a publication (sorted by newest)
subscriptionSchema.index({ publication: 1, subscribedAt: -1 });

// List all subscriptions of a user (sorted by newest)
subscriptionSchema.index({ subscriber: 1, subscribedAt: -1 });

export default mongoose.model("subscriptions", subscriptionSchema);
