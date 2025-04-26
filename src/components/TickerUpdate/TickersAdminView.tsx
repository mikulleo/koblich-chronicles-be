import React from 'react'
import { EditView, useDocumentInfo } from '@payloadcms/ui'
import { RefreshTickerCounts } from './RefreshTickerCounts'

export const TickersAdminView: React.FC = () => {
  const { id } = useDocumentInfo()

  return (
    <div>
      {/* Show the refresh button when we're on a single ticker edit page */}
      {id && <RefreshTickerCounts tickerId={id} />}

      {/* Render the default edit view */}
      <EditView />
    </div>
  )
}

export default TickersAdminView
