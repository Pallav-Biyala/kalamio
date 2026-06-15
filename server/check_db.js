import mongoose from 'mongoose';
import Comment from './Schema/Comment.js';

mongoose.connect('mongodb+srv://kalamiohq:E0m7E5qjT6K26A6t@cluster0.p7hve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
.then(async () => {
    const docs = await Comment.find({ isReply: false }).limit(20);
    console.log(JSON.stringify(docs.map(d => ({id: d._id, comment: d.comment, children: d.children})), null, 2));
    process.exit(0);
})
.catch(err => {
    console.error(err);
    process.exit(1);
});
