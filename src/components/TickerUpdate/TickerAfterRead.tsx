import React from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { RefreshTickerCounts } from './RefreshTickerCounts'

// This component will be used to display the refresh button after the collection data is loaded
const TickerAfterRead: React.FC = () => {
  const { id } = useDocumentInfo()

  // Only show the button when viewing a specific ticker
  if (!id) return null

  return (
    <div style={{ marginBottom: '20px' }}>
      <RefreshTickerCounts tickerId={id} />
    </div>
  )
}

export default TickerAfterRead
