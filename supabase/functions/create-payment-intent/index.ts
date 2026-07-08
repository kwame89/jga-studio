import Stripe from 'npm:stripe@17.7.0';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

console.log('Using Stripe key prefix:', stripeSecretKey.slice(0, 10));

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20',
});

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const body = await req.json();
    const { artworkId, amount, currency = 'usd', title } = body;

    if (!artworkId || !amount || !title) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          received: body,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        artworkId: String(artworkId),
        title: String(title),
      },
    });

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error?.message || 'Unexpected server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
