const nodemailer = require('nodemailer');

// Brevo (Sendinblue) SMTP transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // false for port 587 (STARTTLS)
    requireTLS: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Send booking-related email notification
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML email body
 */
const sendBookingEmail = async (to, subject, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"UniStay" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
        console.log(`📧 Email sent: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error('❌ Email send failed:', error.message);
        // Don't throw — email failure shouldn't block the booking flow
        return null;
    }
};

module.exports = { sendBookingEmail };
