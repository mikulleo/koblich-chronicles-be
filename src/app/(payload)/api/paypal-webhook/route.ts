// src/app/(payload)/api/paypal-webhook/route.ts
import { getPayload } from 'payload'
import crypto from 'crypto'
import config from '@payload-config'

// Verify webhook signature (security best practice)
function verifyWebhookSignature(payload: string, signature: string, webhookId: string) {
  try {
    const webhookSecret = process.env.PAYPAL_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('Missing PayPal webhook secret')
      return false
    }

    // Verification logic based on PayPal docs
    const hmac = crypto.createHmac('sha256', webhookSecret)
    hmac.update(`${webhookId}.${payload}`)
    const calculatedSignature = hmac.digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature, 'hex'),
      Buffer.from(signature, 'hex'),
    )
  } catch (error) {
    console.error('Webhook signature verification error:', error)
    return false
  }
}

export async function POST(req: Request) {
  try {
    const payload = await getPayload({ config })
    const rawBody = await req.text()
    const webhookData = JSON.parse(rawBody)

    // Get webhook signature from headers
    const webhookId = req.headers.get('paypal-webhook-id')
    const signature = req.headers.get('paypal-transmission-sig')

    // Verify webhook if production environment
    if (process.env.NODE_ENV === 'production') {
      if (!webhookId || !signature || !verifyWebhookSignature(rawBody, signature, webhookId)) {
        console.error('Invalid webhook signature')
        return Response.json({ success: false, message: 'Invalid signature' }, { status: 401 })
      }
    }

    // Process PayPal webhook event
    const eventType = webhookData.event_type
    const resource = webhookData.resource

    console.log('Received PayPal webhook:', eventType)

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      // Payment was successful
      const orderId = resource.supplementary_data?.related_ids?.order_id
      const customId = resource.custom_id || '' // Contains our donation ID format

      if (customId.startsWith('donation-')) {
        // Find the donation by payment ID (orderId)
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
                metadata: {
                  ...((donation.metadata as Record<string, any>) || {}),
                  webhookData: webhookData,
                },
              },
            })

            console.log(`Donation ${donation.id} marked as completed`)
          } else {
            console.error('Found donation record but ID is missing')
          }
        }
      }
    } else if (eventType === 'PAYMENT.CAPTURE.DENIED' || eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      // Payment failed or was refunded
      const orderId = resource.supplementary_data?.related_ids?.order_id

      // Find the donation by payment ID
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
              status: eventType === 'PAYMENT.CAPTURE.DENIED' ? 'failed' : 'refunded',
              metadata: {
                ...((donation.metadata as Record<string, any>) || {}),
                webhookData: webhookData,
              },
            },
          })

          console.log(
            `Donation ${donation.id} marked as ${eventType === 'PAYMENT.CAPTURE.DENIED' ? 'failed' : 'refunded'}`,
          )
        } else {
          console.error('Found donation record but ID is missing')
        }
      }
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('PayPal webhook error:', error)
    return Response.json({ success: false, error: 'Webhook processing error' }, { status: 500 })
  }
}
