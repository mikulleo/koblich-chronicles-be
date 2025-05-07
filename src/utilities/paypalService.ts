// src/utilities/paypalService.ts
import axios, { AxiosError } from 'axios'
import { v4 as uuidv4 } from 'uuid'

// Configuration based on environment
const PAYPAL_API_URL =
  process.env.NODE_ENV === 'production' ? 'https://api-m.paypal.com' : 'https://api-m.paypal.com'

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET
const REDIRECT_URL =
  process.env.PAYLOAD_PUBLIC_SERVER_URL || 'https://koblich-chronicles-be-production.up.railway.app'

export const paypalService = {
  // Get access token from PayPal
  async getAccessToken() {
    try {
      const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')
      const response = await axios.post(
        `${PAYPAL_API_URL}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      )
      return response.data.access_token
    } catch (error) {
      console.error('Error getting PayPal access token:', error)
      throw error
    }
  },

  // Create a PayPal order
  async createOrder(
    amount: number,
    currency: string = 'USD',
    comment: string = 'Donation to Koblich Chronicles',
  ) {
    const transactionId = uuidv4()
    try {
      // Get access token
      const accessToken = await this.getAccessToken()

      // Format amount with two decimal places
      const formattedAmount = amount.toFixed(2)

      // Create order payload
      const payload = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: transactionId,
            description: comment,
            amount: {
              currency_code: currency,
              value: formattedAmount,
              breakdown: {
                item_total: {
                  currency_code: currency,
                  value: formattedAmount,
                },
              },
            },
            items: [
              {
                name: 'Donation to Koblich Chronicles',
                description: comment || 'Supporting the Koblich Chronicles project',
                quantity: '1',
                unit_amount: {
                  currency_code: currency,
                  value: formattedAmount,
                },
                category: 'DONATION',
              },
            ],
            custom_id: `donation-${transactionId.substring(0, 8)}`,
          },
        ],
        application_context: {
          brand_name: 'Koblich Chronicles',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          return_url: `${REDIRECT_URL}/donation/thank-you`,
          cancel_url: `${REDIRECT_URL}/donation/cancel`,
        },
      }

      // Debug logging
      console.log('PayPal API Request:', JSON.stringify(payload, null, 2))

      // Create order
      const response = await axios.post(`${PAYPAL_API_URL}/v2/checkout/orders`, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      console.log('PayPal API Response:', response.data)

      // Find approval URL for redirect
      const approvalUrl = response.data.links.find((link: any) => link.rel === 'approve')?.href

      return {
        success: true,
        transactionId,
        paymentId: response.data.id,
        gatewayUrl: approvalUrl,
        status: response.data.status,
      }
    } catch (error) {
      console.error('PayPal payment initiation error:', error)
      if (error instanceof AxiosError && error.response) {
        console.error('PayPal error response:', error.response.data)
      }
      return {
        success: false,
        error: 'Failed to initiate payment',
      }
    }
  },

  // Capture payment after approval
  async capturePayment(orderId: string) {
    try {
      const accessToken = await this.getAccessToken()

      const response = await axios.post(
        `${PAYPAL_API_URL}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      )

      return {
        success: true,
        status: response.data.status,
        data: response.data,
      }
    } catch (error) {
      console.error('PayPal capture payment error:', error)
      return {
        success: false,
        error: 'Failed to capture payment',
      }
    }
  },

  // Get order details
  async getOrderDetails(orderId: string) {
    try {
      const accessToken = await this.getAccessToken()

      const response = await axios.get(`${PAYPAL_API_URL}/v2/checkout/orders/${orderId}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      })

      return {
        success: true,
        data: response.data,
        status: response.data.status,
        transactionId: response.data.id,
      }
    } catch (error) {
      console.error('PayPal get order details error:', error)
      return {
        success: false,
        error: 'Failed to get order details from PayPal',
      }
    }
  },
}
