const Stripe = require('stripe');

// Only initialize Stripe if the key is configured.
// This prevents the server from crashing at startup when the key is not yet set.
const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;

module.exports = stripe;
