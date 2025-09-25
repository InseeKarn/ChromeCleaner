import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function handler(event, context) {
  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_TEST; 

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const amount = session.amount_total;


    try {
      await fetch('https://script.google.com/macros/s/AKfycbyxjRwmCxnyCNQVZhUyEtnWs-dkaKLS-29JoxZJZpILG9EWecQsqTBqMBN1ZDUHPxY/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amount / 100 })
      });
      console.log(`Donation sent to Google Sheets: $${amount / 100}`);
    } catch (err) {
      console.error('Failed to record donation:', err);
    }
  }

  return { statusCode: 200, body: 'Received' };
}
