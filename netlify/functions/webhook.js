import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_TEST_KEY);

export async function handler(event, context) {
  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET; 

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

    
    const fs = require('fs');
    const path = './donations.json';
    let donations = { total: 0 };
    if (fs.existsSync(path)) {
      donations = JSON.parse(fs.readFileSync(path, 'utf8'));
    }
    donations.total += amount / 100;
    fs.writeFileSync(path, JSON.stringify(donations));

    console.log(`Donation received: $${amount / 100}`);
  }

  return { statusCode: 200, body: 'Received' };
}
