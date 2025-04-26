'use client'

import React from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { RefreshTickerCounts } from './RefreshTickerCounts'

// Description component that shows below the collection label in the List View
// and also in the Edit view
const TickerDescription: React.FC = () => {
  const { id } = useDocumentInfo()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
      <div>
        Manage your stock tickers and their associated counts.
        {id
          ? "Use the button below to refresh this ticker's counts."
          : "Use the button below to refresh all tickers' counts."}
      </div>

      <RefreshTickerCounts tickerId={id} />
    </div>
  )
}

export default TickerDescription
