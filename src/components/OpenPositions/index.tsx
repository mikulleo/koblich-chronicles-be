'use client';

import React, { useState, useEffect } from 'react';
import { useConfig } from '@payloadcms/ui';

// Define interfaces for type safety
interface Ticker {
  id: string | number;
  symbol: string;
}

interface Trade {
  id: string | number;
  ticker: Ticker | string;
  type: 'long' | 'short';
  entryPrice: number;
  shares: number;
  initialStopLoss: number;
  modifiedStops?: {
    price: number;
    date: string;
  }[];
  exits?: {
    price: number;
    shares: number;
    date: string;
  }[];
  status: 'open' | 'partial' | 'closed';
  currentPrice?: number;
  currentMetrics?: {
    profitLossAmount: number;
    profitLossPercent: number;
    rRatio: number;
    riskAmount: number;
    riskPercent: number;
    breakEvenShares: number;
    lastUpdated?: string;
  };
}

export const OpenPositions: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [editingPriceId, setEditingPriceId] = useState<string | number | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');
  
  const config = useConfig();
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.PAYLOAD_PUBLIC_SERVER_URL || '';
  
  // Fetch open trades
  useEffect(() => {
    const fetchOpenTrades = async () => {
      setLoading(true);
      
      try {
        const response = await fetch(`${baseUrl}/api/trades?where[status][not_equals]=closed&limit=100&depth=1`);
        const data = await response.json();
        
        if (data.docs && Array.isArray(data.docs)) {
          // Sort by ticker symbol
          const sortedTrades = [...data.docs].sort((a, b) => {
            const symbolA = typeof a.ticker === 'object' ? a.ticker.symbol : '';
            const symbolB = typeof b.ticker === 'object' ? b.ticker.symbol : '';
            return symbolA.localeCompare(symbolB);
          });
          
          setOpenTrades(sortedTrades);
        }
      } catch (error) {
        console.error('Error fetching open trades:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOpenTrades();
    
    // Poll for updates every 5 minutes
    const intervalId = setInterval(fetchOpenTrades, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [baseUrl]);
  
  // Function to start editing price
  const startEditingPrice = (trade: Trade) => {
    setEditingPriceId(trade.id);
    setTempPrice(trade.currentPrice ? trade.currentPrice.toString() : '');
  };
  
  // Function to cancel editing
  const cancelEditing = () => {
    setEditingPriceId(null);
    setTempPrice('');
  };
  
  // Function to update current price
  const updateCurrentPrice = async (tradeId: string | number) => {
    if (!tempPrice || isNaN(parseFloat(tempPrice))) {
      cancelEditing();
      return;
    }
    
    try {
      const response = await fetch(`${baseUrl}/api/trades/${tradeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPrice: parseFloat(tempPrice),
        }),
      });
      
      if (response.ok) {
        const updatedTrade = await response.json();
        
        // Update the trade in the state
        setOpenTrades(prev => 
          prev.map(trade => 
            trade.id === tradeId ? updatedTrade : trade
          )
        );
      }
    } catch (error) {
      console.error('Error updating price:', error);
    } finally {
      cancelEditing();
    }
  };
  
  // Function to format numbers as currency
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  // Function to format percentages
  const formatPercent = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    return `${value.toFixed(2)}%`;
  };
  
  // Function to format dates
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };
  
  // Function to get the ticker symbol
  const getTickerSymbol = (ticker: Ticker | string | undefined) => {
    if (!ticker) return '-';
    return typeof ticker === 'object' ? ticker.symbol : ticker;
  };

  // Function to get the most recent stop loss
  const getCurrentStopLoss = (trade: Trade) => {
    if (trade.modifiedStops && trade.modifiedStops.length > 0) {
      // Sort by date descending
      const sortedStops = [...trade.modifiedStops].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return sortedStops[0] ? sortedStops[0].price : trade.initialStopLoss;
    }
    return trade.initialStopLoss;
  };
  
  // Function to calculate remaining shares
  const getRemainingShares = (trade: Trade) => {
    if (!trade.exits || trade.exits.length === 0) return trade.shares;
    
    const exitedShares = trade.exits.reduce((sum, exit) => sum + exit.shares, 0);
    return trade.shares - exitedShares;
  };
  
  return (
    <div className="open-positions">
      <h2>Open Positions</h2>
      
      {loading ? (
        <div className="loading">Loading open positions...</div>
      ) : openTrades.length === 0 ? (
        <div className="no-data">No open positions found.</div>
      ) : (
        <div className="table-container">
          <table className="positions-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Type</th>
                <th>Status</th>
                <th>Entry</th>
                <th>Shares</th>
                <th>Current Price</th>
                <th>Stop Loss</th>
                <th>P/L ($)</th>
                <th>P/L (%)</th>
                <th>R-Ratio</th>
                <th>Risk ($)</th>
                <th>Risk (%)</th>
                <th>BE Shares</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {openTrades.map(trade => (
                <tr key={trade.id}>
                  <td>{getTickerSymbol(trade.ticker)}</td>
                  <td>{trade.type.toUpperCase()}</td>
                  <td>{trade.status}</td>
                  <td>{formatCurrency(trade.entryPrice)}</td>
                  <td>{getRemainingShares(trade)} / {trade.shares}</td>
                  <td>
                    {editingPriceId === trade.id ? (
                      <div className="price-edit">
                        <input
                          type="number"
                          value={tempPrice}
                          onChange={(e) => setTempPrice(e.target.value)}
                          step="0.01"
                          min="0"
                        />
                        <div className="edit-actions">
                          <button 
                            className="save-btn"
                            onClick={() => updateCurrentPrice(trade.id)}
                          >
                            ✓
                          </button>
                          <button 
                            className="cancel-btn"
                            onClick={cancelEditing}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="editable-price"
                        onClick={() => startEditingPrice(trade)}
                      >
                        {trade.currentPrice ? formatCurrency(trade.currentPrice) : 'Set price'}
                      </div>
                    )}
                  </td>
                  <td>{formatCurrency(getCurrentStopLoss(trade))}</td>
                  
                  {/* Current metrics */}
                  <td className={trade.currentMetrics?.profitLossAmount && trade.currentMetrics.profitLossAmount >= 0 ? 'positive' : 'negative'}>
                    {trade.currentMetrics ? formatCurrency(trade.currentMetrics.profitLossAmount) : '-'}
                  </td>
                  <td className={trade.currentMetrics?.profitLossPercent && trade.currentMetrics.profitLossPercent >= 0 ? 'positive' : 'negative'}>
                    {trade.currentMetrics ? formatPercent(trade.currentMetrics.profitLossPercent) : '-'}
                  </td>
                  <td className={trade.currentMetrics?.rRatio && trade.currentMetrics.rRatio >= 0 ? 'positive' : 'negative'}>
                    {trade.currentMetrics ? trade.currentMetrics.rRatio.toFixed(2) : '-'}
                  </td>
                  <td>
                    {trade.currentMetrics ? formatCurrency(trade.currentMetrics.riskAmount) : '-'}
                  </td>
                  <td>
                    {trade.currentMetrics ? formatPercent(trade.currentMetrics.riskPercent) : '-'}
                  </td>
                  <td>
                    {trade.currentMetrics ? Math.round(trade.currentMetrics.breakEvenShares * 100) / 100 : '-'}
                  </td>
                  <td>
                    {trade.currentMetrics?.lastUpdated ? formatDate(trade.currentMetrics.lastUpdated) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <style jsx>{`
        .open-positions {
          margin-top: 30px;
          margin-bottom: 40px;
        }
        
        h2 {
          margin-bottom: 15px;
        }
        
        .loading, .no-data {
          padding: 20px;
          text-align: center;
          color: #666;
          background-color: #f9f9f9;
          border-radius: 4px;
        }
        
        .table-container {
          overflow-x: auto;
        }
        
        .positions-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        
        .positions-table th,
        .positions-table td {
          padding: 10px;
          text-align: right;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .positions-table th {
          background-color: #f5f5f5;
          font-weight: 600;
          text-align: center;
        }
        
        .positions-table tr:hover {
          background-color: #f9f9f9;
        }
        
        .positions-table td:first-child,
        .positions-table th:first-child {
          text-align: left;
        }
        
        .positive {
          color: #4CAF50;
          font-weight: 500;
        }
        
        .negative {
          color: #FF5252;
          font-weight: 500;
        }
        
        .editable-price {
          cursor: pointer;
          padding: 3px 6px;
          border-radius: 4px;
          display: inline-block;
        }
        
        .editable-price:hover {
          background-color: #f0f0f0;
        }
        
        .price-edit {
          display: flex;
          align-items: center;
        }
        
        .price-edit input {
          width: 80px;
          padding: 4px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        
        .edit-actions {
          display: flex;
          flex-direction: column;
          margin-left: 5px;
        }
        
        .edit-actions button {
          padding: 2px 5px;
          margin: 1px;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 12px;
        }
        
        .save-btn {
          background-color: #4CAF50;
          color: white;
        }
        
        .cancel-btn {
          background-color: #FF5252;
          color: white;
        }
      `}</style>
    </div>
  );
};

export default OpenPositions;