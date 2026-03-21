const multer = require('multer');
const { uploadToSupabase } = require('./supabase');

// ── Multer: memory storage → then upload to Supabase ─────────────────────────

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only JPG and PNG images are allowed'), false);
        }
    },
});

const uploadDocs = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only images (JPG, PNG) and PDF files are allowed'), false);
        }
    },
});

// ── Helper: upload a multer file to Supabase ─────────────────────────────────
const uploadFile = async (file, folder) => {
    return uploadToSupabase(file.buffer, file.originalname, folder, file.mimetype);
};

module.exports = { upload, uploadDocs, uploadFile };
