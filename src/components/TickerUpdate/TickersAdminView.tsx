import React from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { RefreshTickerCounts } from './RefreshTickerCounts'

export const TickersAdminView: React.FC = () => {
  const { id } = useDocumentInfo()

  return (
    <div>
      {/* Show the refresh button when we're on a single ticker edit page */}
      {id && <RefreshTickerCounts tickerId={id} />}
    </div>
  )
}

export default TickersAdminView
