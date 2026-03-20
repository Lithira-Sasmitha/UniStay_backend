const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// ── Initialize Supabase ──────────────────────────────────────────────────────
let supabase = null;
const PHOTOS_BUCKET = 'property-photos';
const DOCS_BUCKET = 'verification-docs';

const initSupabase = () => {
    if (supabase) return supabase;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
        console.warn('⚠️  SUPABASE_URL or SUPABASE_SERVICE_KEY not set — file uploads will not persist');
        return null;
    }

    supabase = createClient(url, key);
    console.log('✅ Supabase Storage configured');
    return supabase;
};

// ── Upload a file buffer to Supabase Storage ─────────────────────────────────
const uploadToSupabase = async (fileBuffer, originalName, folder, mimetype) => {
    const client = initSupabase();
    if (!client) throw new Error('Supabase Storage not configured');

    const ext = originalName.split('.').pop();
    const fileName = `${folder}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
    const bucket = folder === 'unistay_docs' ? DOCS_BUCKET : PHOTOS_BUCKET;

    const { error } = await client.storage
        .from(bucket)
        .upload(fileName, fileBuffer, {
            contentType: mimetype,
            upsert: false,
        });

    if (error) throw new Error(`Supabase upload failed: ${error.message}`);

    const { data: urlData } = client.storage.from(bucket).getPublicUrl(fileName);

    return { url: urlData.publicUrl, filePath: `${bucket}/${fileName}` };
};

// ── Delete a file from Supabase Storage ──────────────────────────────────────
const deleteFromSupabase = async (filePath) => {
    if (!filePath) return;
    const client = initSupabase();
    if (!client) return;

    // filePath format: "bucket/folder/filename" or old Cloudinary ID (skip those)
    const parts = filePath.split('/');
    if (parts.length < 2) return; // Old Cloudinary publicId — skip

    const bucket = parts[0];
    const path = parts.slice(1).join('/');

    try {
        await client.storage.from(bucket).remove([path]);
    } catch (err) {
        console.warn('Supabase delete warning:', err.message);
    }
};

// Initialize eagerly on require
initSupabase();

module.exports = { initSupabase, uploadToSupabase, deleteFromSupabase };
