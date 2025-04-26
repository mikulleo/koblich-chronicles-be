'use client'

import React, { useState } from 'react'
import { Button } from '@payloadcms/ui'
export const RefreshTickerCounts: React.FC<{
  tickerId?: string | number
}> = ({ tickerId }) => {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshCounts = async () => {
    try {
      setIsRefreshing(true)

      // Determine the base URL for API requests
      const baseURL = typeof window !== 'undefined' ? window.location.origin : ''

      // Make the API request to refresh counts
      const response = await fetch(`${baseURL}/api/tickers/refresh-counts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tickerId: tickerId,
        }),
        credentials: 'include',
      })

      const data = await response.json()

      if (data.success) {
        alert(data.message || 'Counts refreshed successfully')
        // Reload the page to show updated counts
        window.location.reload()
      } else {
        alert(data.error || 'Failed to refresh counts')
      }
    } catch (error) {
      console.error('Error refreshing counts:', error)
      alert('An error occurred while refreshing counts')
    } finally {
      setIsRefreshing(false)
    }
  }

  // Use Payload's Button component for consistent styling
  return (
    <Button
      onClick={refreshCounts}
      disabled={isRefreshing}
      buttonStyle="primary"
      size="medium"
      type="button"
    >
      {isRefreshing ? (
        <>
          <span
            style={{
              display: 'inline-block',
              animation: 'spin 1s linear infinite',
              marginRight: '5px',
            }}
          >
            ↻
          </span>
          Refreshing...
        </>
      ) : (
        <>
          <span style={{ marginRight: '5px' }}>↻</span>
          {tickerId ? 'Refresh Ticker Counts' : 'Refresh All Ticker Counts'}
        </>
      )}

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </Button>
  )
}

export default RefreshTickerCounts
