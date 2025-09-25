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


    async function addDonation(amount) {
        try {
            await fetch('https://script.google.com/macros/s/AKfycbw3InaLalRNRK33BKWvtro6JO_ihoFwfCMocwEkaU_TtVNu_S-AQVf9ZBlj6f7obN8/exec', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: amount / 100 })
            });
            console.log(`Donation sent to Web App: $${amount / 100}`);
        } catch (err) {
            console.error('Failed to record donation:', err);
        }
    }

    addDonation(amount);
    
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
