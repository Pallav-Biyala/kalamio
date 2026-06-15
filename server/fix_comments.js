import mongoose from 'mongoose';
import Comment from './Schema/Comment.js';
import Blog from './Schema/Blog.js';

mongoose.connect('mongodb+srv://kalamiohq:E0m7E5qjT6K26A6t@cluster0.p7hve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
.then(async () => {
    try {
        const blog_id = 'Running-Into-the-Silence-How-Long-Roads-Empty-Horizons-and-Daily-Miles-Quiet-the-Mindya1hbHSSgbSxVYJ1Qv3tB';
        const blog = await Blog.findOne({ blog_id: blog_id });
        console.log("Blog total_parent_comments:", blog.activity.total_parent_comments);

        const actual_parent_count = await Comment.countDocuments({ blog_id: blog._id, isReply: false });
        console.log("Actual parent comments in DB:", actual_parent_count);

        if (blog.activity.total_parent_comments !== actual_parent_count) {
            console.log("Fixing out-of-sync counter...");
            await Blog.updateOne({ _id: blog._id }, { $set: { "activity.total_parent_comments": actual_parent_count } });
            console.log("Fixed!");
        }
    } catch(err) {
        console.error(err);
    }
    process.exit(0);
});
