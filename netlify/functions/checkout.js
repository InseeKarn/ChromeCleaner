import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-08-27' });

export async function handler(event, context) {
  console.log('Request body:', event.body);
  try {

    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'No request body' })
      };
    }

    const { amount } = JSON.parse(event.body);

    if (!amount) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Amount is required' })
      };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Donate' }, 
          unit_amount: amount * 100,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'https://chromecleaner.netlify.app/.netlify/functions/success',
      cancel_url: 'https://chromecleaner.netlify.app/.netlify/functions/cancel',
    });

    return { 
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error('Stripe error:', err);
    return { 
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ error: err.message || 'Internal server error' })
    };
    
  }
  
}

