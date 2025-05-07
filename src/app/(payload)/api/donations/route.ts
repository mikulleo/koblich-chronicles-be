// src/app/(payload)/api/donations/route.ts
import { getPayload } from 'payload'
import { paypalService } from '@/utilities/paypalService'
import config from '@payload-config'

export async function OPTIONS(req: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

export async function POST(req: Request) {
  try {
    const payload = await getPayload({ config })
    const body = await req.json()

    // Validate the request
    const { amount, currency = 'USD', donorName, donorEmail, message } = body

    if (!amount || amount < 1) {
      return Response.json({ success: false, error: 'Invalid amount' }, { status: 400 })
    }

    // Initialize payment with PayPal
    const paymentResult = await paypalService.createOrder(
      amount,
      currency,
      `Donation to Koblich Chronicles${message ? `: ${message.substring(0, 50)}` : ''}`,
    )

    if (!paymentResult.success) {
      return Response.json({ success: false, error: paymentResult.error }, { status: 500 })
    }

    // Create donation record in Payload
    const donation = await payload.create({
      collection: 'donations',
      data: {
        amount,
        currency,
        status: 'initiated',
        transactionId: paymentResult.transactionId,
        paymentId: paymentResult.paymentId,
        donor: {
          name: donorName || 'Anonymous',
          email: donorEmail || '',
          message: message || '',
        },
        metadata: paymentResult,
      },
    })

    return Response.json(
      {
        success: true,
        paymentId: paymentResult.paymentId,
        gatewayUrl: paymentResult.gatewayUrl,
        donationId: donation.id,
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
      },
    )
  } catch (error) {
    console.error('Donation initiation error:', error)
    return Response.json({ success: false, error: 'Failed to process donation' }, { status: 500 })
  }
}
