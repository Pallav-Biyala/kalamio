import mongoose from 'mongoose';

const main = async () => {
    try {
        await mongoose.connect('mongodb://harish82817:uMAYSH6nYoGEjRs9@ac-fjy5xn6-shard-00-00.gwq5d2i.mongodb.net:27017,ac-fjy5xn6-shard-00-01.gwq5d2i.mongodb.net:27017,ac-fjy5xn6-shard-00-02.gwq5d2i.mongodb.net:27017/?ssl=true&replicaSet=atlas-686b84-shard-0&authSource=admin&appName=MainCluster', { autoIndex: false });
        const Blog = mongoose.model('Blog', new mongoose.Schema({}, { strict: false }));
        
        const titleToFind = "Consistency Beats Motivation Every Time";
        const newBanner = 'https://blog-app-82817.s3.ap-south-1.amazonaws.com/_Dgeu9uAg96-FU544ds-i-1766769784558.jpeg';
        
        const result = await Blog.updateOne(
            { title: { $regex: new RegExp(titleToFind, 'i') } },
            { $set: { banner: newBanner } }
        );
        
        console.log('Update result:', result);
        
        const updated = await Blog.findOne({ title: { $regex: new RegExp(titleToFind, 'i') } }, { title: 1, banner: 1 });
        console.log('Verification:', updated ? updated.title + ' -> ' + updated.banner : 'Not found');
        
    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
};

main();
