import { getPayload } from 'payload'
import { barionService } from '@/utilities/barionService'
import config from '@payload-config'

export async function POST(req: Request) {
  try {
    const payload = await getPayload({ config })
    const data = await req.json()

    // Extract payment ID from the callback
    const { paymentId } = data

    if (!paymentId) {
      return Response.json({ success: false, error: 'No payment ID provided' }, { status: 400 })
    }

    // Get the latest payment state from Barion
    const paymentState = await barionService.getPaymentState(paymentId)

    if (!paymentState.success) {
      return Response.json(
        { success: false, error: 'Failed to get payment state' },
        { status: 500 },
      )
    }

    // Find the donation by paymentId
    const donations = await payload.find({
      collection: 'donations',
      where: {
        paymentId: {
          equals: paymentId,
        },
      },
    })

    if (!donations.docs.length) {
      return Response.json({ success: false, error: 'Donation not found' }, { status: 404 })
    }

    const donation = donations.docs[0] as any

    // Update donation status based on Barion status
    let newStatus
    switch (paymentState.status) {
      case 'Succeeded':
        newStatus = 'completed'
        break
      case 'Failed':
        newStatus = 'failed'
        break
      case 'Canceled':
        newStatus = 'canceled'
        break
      default:
        newStatus = donation.status // Keep current status
    }

    // Update the donation with the new status
    await payload.update({
      collection: 'donations',
      id: donation.id,
      data: {
        status: newStatus,
        metadata: {
          ...donation.metadata,
          callbackProcessed: new Date().toISOString(),
          paymentState: paymentState.data,
        },
      },
    })

    return Response.json({ success: true, status: newStatus })
  } catch (error) {
    console.error('Barion callback processing error:', error)
    return Response.json({ success: false, error: 'Failed to process callback' }, { status: 500 })
  }
}
