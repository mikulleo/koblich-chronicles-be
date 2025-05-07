// src/app/(payload)/api/paypal-capture/route.ts
import { getPayload } from 'payload'
import { paypalService } from '@/utilities/paypalService'
import config from '@payload-config'
import { safelyUpdateMetadata } from '@/utilities/safelyUpdateMetadata'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return Response.json({ success: false, error: 'Order ID is required' }, { status: 400 })
    }

    // Capture the payment
    const captureResult = await paypalService.capturePayment(orderId)

    if (!captureResult.success) {
      return Response.json({ success: false, error: captureResult.error }, { status: 500 })
    }

    const payload = await getPayload({ config })

    // Find the donation by payment ID (order ID)
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

      if (donation && donation.id) {
        // Update donation status
        await payload.update({
          collection: 'donations',
          id: donation.id,
          data: {
            status: 'completed',
            metadata: safelyUpdateMetadata(donation.metadata, {
              captureData: captureResult.data,
            }),
          },
        })
      }
    }

    return Response.json({ success: true, status: captureResult.status })
  } catch (error) {
    console.error('PayPal capture error:', error)
    return Response.json({ success: false, error: 'Failed to capture payment' }, { status: 500 })
  }
}
