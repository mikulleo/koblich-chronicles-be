// src/app/(payload)/api/paypal-capture/route.ts
import { getPayload } from 'payload'
import { paypalService } from '@/utilities/paypalService'
import config from '@payload-config'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return Response.json({ success: false, error: 'Order ID is required' }, { status: 400 })
    }

    // Instead of capturing, just get order details
    const orderResult = await paypalService.getOrderDetails(orderId)

    if (!orderResult.success) {
      return Response.json({ success: false, error: orderResult.error }, { status: 500 })
    }

    const payload = await getPayload({ config })

    // Find the donation by payment ID (order ID) without sending any limit parameter
    const donations = await payload.find({
      collection: 'donations',
      where: {
        paymentId: {
          equals: orderId,
        },
      },
    })

    if (donations.docs.length > 0) {
      const donation = donations.docs[0]

      // Only update if donation exists and is not already completed
      if (donation && donation.status !== 'completed') {
        // Update donation status
        await payload.update({
          collection: 'donations',
          id: donation.id,
          data: {
            status: orderResult.status === 'COMPLETED' ? 'completed' : donation.status,
            metadata: {
              ...((donation.metadata as Record<string, unknown>) || {}),
              orderDetails: orderResult.data,
            },
          },
        })
      }
    }

    return Response.json({ success: true, status: orderResult.status })
  } catch (error) {
    console.error('PayPal order details error:', error)
    return Response.json(
      { success: false, error: 'Failed to get payment details' },
      { status: 500 },
    )
  }
}
