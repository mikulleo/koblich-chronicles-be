// src/utilities/barionService.ts
import axios, { AxiosError } from 'axios'
import { v4 as uuidv4 } from 'uuid'

// Configuration based on environment
const BARION_API_URL =
  process.env.NODE_ENV === 'production' ? 'https://api.barion.com' : 'https://api.test.barion.com'

//const BARION_API_URL = 'https://api.barion.com'

const BARION_POS_KEY = process.env.BARION_POS_KEY
const REDIRECT_URL = process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'
//const REDIRECT_URL = 'https://www.koblich-chronicles.com'

export const barionService = {
  async startPayment(
    amount: number,
    currency: string = 'CZK',
    comment: string = 'Donation to Koblich Chronicles',
  ) {
    const transactionId = uuidv4()

    try {
      const payload = {
        POSKey: BARION_POS_KEY,
        PaymentType: 'Immediate',
        PaymentWindow: '00:30:00',
        GuestCheckout: true, // Boolean, not string
        FundingSources: ['All', 'ApplePay'],
        PaymentRequestId: transactionId,
        OrderNumber: `donation-${transactionId.substring(0, 8)}`,
        Locale: 'en-US',
        Currency: currency,
        Transactions: [
          {
            POSTransactionId: transactionId,
            Payee: process.env.BARION_PAYEE_EMAIL || '',
            Total: amount,
            Items: [
              {
                Name: 'Donation to Koblich Chronicles',
                Description: comment || 'Supporting the Koblich Chronicles project',
                Quantity: 1,
                Unit: 'item',
                UnitPrice: amount,
                ItemTotal: amount,
                SKU: 'donation-item',
              },
            ],
          },
        ],
        RedirectUrl: `${REDIRECT_URL}/donation/thank-you`,
        CallbackUrl: `${REDIRECT_URL}/api/barion-callback`,
      }

      // Add debug logging
      console.log('Barion API Request:', JSON.stringify(payload, null, 2))

      const response = await axios.post(`${BARION_API_URL}/v2/Payment/Start`, payload)

      console.log('Barion API Response:', response.data)
      return {
        success: true,
        transactionId,
        paymentId: response.data.PaymentId,
        gatewayUrl: response.data.GatewayUrl,
        status: response.data.Status,
      }
    } catch (error) {
      console.error('Barion payment initiation error:', error)
      // Log the error details
      if (error instanceof AxiosError && error.response) {
        console.error('Barion error response:', error.response.data)
      }
      return {
        success: false,
        error: 'Failed to initiate payment',
      }
    }
  },

  async getPaymentState(paymentId: string) {
    try {
      const response = await axios.get(`${BARION_API_URL}/v2/Payment/GetPaymentState`, {
        params: {
          POSKey: BARION_POS_KEY,
          PaymentId: paymentId,
        },
      })

      return {
        success: true,
        status: response.data.Status,
        data: response.data,
      }
    } catch (error) {
      console.error('Barion get payment state error:', error)
      return {
        success: false,
        error: 'Failed to get payment state',
      }
    }
  },
}
