import axios from "axios";
import api from "./api";

export const uploadImage = async (img) => {

    let imgURL = null;

    await api.get(`/get-upload-url?type=${encodeURIComponent(img.type)}`)
    .then( async ({ data: { uploadURL } }) => {
        // Use raw axios for S3 — NOT the `api` instance,
        // because the interceptor adds a JWT Authorization header
        // that conflicts with S3's presigned URL authentication.
        await axios({
            method: 'PUT',
            url: uploadURL,
            headers: {
                'Content-Type': img.type,
                // Must EXACTLY match the CacheControl signed into the presigned URL by
                // the backend (config/s3.js), or S3 rejects with 403 SignatureDoesNotMatch.
                // Unique filenames make each object immutable → cache for a year.
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
            data: img
        })
        .then(() => {
            imgURL = uploadURL.split("?")[0]
        })
    })

    return imgURL;

}