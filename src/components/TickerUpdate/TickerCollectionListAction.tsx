import React from 'react'
import { RefreshTickerCounts } from './RefreshTickerCounts'

// This component appears before the list view
const TickerCollectionListAction: React.FC = () => {
  return (
    <div style={{ marginBottom: '20px' }}>
      <RefreshTickerCounts />
    </div>
  )
}

export default TickerCollectionListAction
