const run = async () => {
    try {
        const blogRes = await fetch('http://localhost:3000/get-blog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blog_id: 'Running-Into-the-Silence-How-Long-Roads-Empty-Horizons-and-Daily-Miles-Quiet-the-Mindya1hbHSSgbSxVYJ1Qv3tB' })
        });
        const blogData = await blogRes.json();
        const blog = blogData.blog;

        const commentsRes = await fetch('http://localhost:3000/get-blog-comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blog_id: blog._id, skip: 0 })
        });
        const comments = await commentsRes.json();
        console.log("Comments:", JSON.stringify(comments.map(c => ({ id: c._id, text: c.comment, children: c.children, length: c.children?.length })), null, 2));

    } catch(err) {
        console.error(err.message);
    }
}

run();
