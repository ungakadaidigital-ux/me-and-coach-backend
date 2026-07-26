// Placeholder for Razorpay payment-link generation. Wire this up once
// RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are provisioned.
async function createPaymentLink({ amount, description, customerPhone }) {
  if (!process.env.RAZORPAY_KEY_ID) {
    return { ok: true, link: `https://pay.meandcoach.in/simulated/${Date.now()}` };
  }
  // TODO: call Razorpay Payment Links API with RAZORPAY_KEY_ID/SECRET.
  throw new Error("Razorpay integration not yet configured");
}

module.exports = { createPaymentLink };
