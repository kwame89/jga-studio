import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
})

serve(async (req) => {
  try {
    const { price, title, art_piece_id } = await req.json()

    if (!price || !title) {
      throw new Error("Price and title are required")
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: title,
              description: `Original artwork from JGA Studio`,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://yourdomain.com/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://yourdomain.com/cancel',
      metadata: {
        art_piece_id: art_piece_id?.toString() || '',
        title: title,
      },
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error: any) {
    console.error("Checkout session error:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})