const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configure Cloudinary (safe even without credentials — will fail at upload time)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
    api_key: process.env.CLOUDINARY_API_KEY || '',
    api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

// ── Build the upload middlewares ─────────────────────────────────────────────
let upload;      // For property photos only (images)
let uploadDocs;  // For property photos + verification docs (images + PDFs)

if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
) {
    const { CloudinaryStorage } = require('multer-storage-cloudinary');

    // Storage for property photos (images only)
    const photoStorage = new CloudinaryStorage({
        cloudinary,
        params: {
            folder: 'unistay_properties',
            allowed_formats: ['jpg', 'jpeg', 'png'],
            transformation: [{ width: 1200, height: 800, crop: 'limit', quality: 'auto' }],
        },
    });

    // Storage for verification docs (images + PDFs)
    const docStorage = new CloudinaryStorage({
        cloudinary,
        params: {
            folder: 'unistay_uploads',
            allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
            resource_type: 'auto',
        },
    });

    upload = multer({
        storage: photoStorage,
        limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
        fileFilter: (_req, file, cb) => {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Only JPG and PNG images are allowed'), false);
            }
        },
    });

    uploadDocs = multer({
        storage: docStorage,
        limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB (PDFs can be larger)
        fileFilter: (_req, file, cb) => {
            if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
                cb(null, true);
            } else {
                cb(new Error('Only images (JPG, PNG) and PDF files are allowed'), false);
            }
        },
    });

    console.log('✅ Cloudinary storage configured (photos + docs)');
} else {
    // Fallback: memory storage — uploads won't persist but server boots fine
    upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 },
    });
    uploadDocs = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
    });
    console.warn('⚠️  Cloudinary credentials missing — using in-memory storage (uploads will not persist)');
}

module.exports = { cloudinary, upload, uploadDocs };
