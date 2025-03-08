'use client';

import React, { useState, useEffect } from 'react';
import { useConfig } from '@payloadcms/ui';
import dayjs from 'dayjs';

// Define interfaces for type safety
interface Ticker {
  id: string | number;
  symbol: string;
  name: string;
}

interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  battingAverage: number;
  averageWinPercent: number;
  averageLossPercent: number;
  winLossRatio: number;
  averageRRatio: number;
  profitFactor: number;
  expectancy: number;
  averageDaysHeldWinners: number;
  averageDaysHeldLosers: number;
  maxGainPercent: number;
  maxLossPercent: number;
  maxGainLossRatio: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
}

export default function StatsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [timeframe, setTimeframe] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTicker, setSelectedTicker] = useState('all');
  const [tickers, setTickers] = useState<Ticker[]>([]);
  
  const config = useConfig();
  // Get the base URL for API requests
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.PAYLOAD_PUBLIC_SERVER_URL || '';
  
  // Set default date range based on timeframe
  useEffect(() => {
    const now = dayjs();
    let start;
    
    switch (timeframe) {
      case 'week':
        start = now.subtract(1, 'week').format('YYYY-MM-DD');
        break;
      case 'month':
        start = now.subtract(1, 'month').format('YYYY-MM-DD');
        break;
      case 'year':
        start = now.subtract(1, 'year').format('YYYY-MM-DD');
        break;
      case 'all':
        start = now.subtract(10, 'year').format('YYYY-MM-DD');
        break;
      default:
        // Custom timeframe - don't change dates
        return;
    }
    
    const end = now.format('YYYY-MM-DD');
    
    setStartDate(start);
    setEndDate(end);
  }, [timeframe]);
  
  // Fetch tickers
  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const response = await fetch(`${baseUrl}/api/tickers?limit=100`);
        const data = await response.json();
        setTickers(data.docs || []);
      } catch (error) {
        console.error('Error fetching tickers:', error);
      }
    };
    
    fetchTickers();
  }, [baseUrl]);
  
  // Fetch statistics when parameters change
  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      
      try {
        let url = `${baseUrl}/api/trades/stats?startDate=${startDate}&endDate=${endDate}`;
        
        if (selectedTicker !== 'all') {
          url += `&tickerId=${selectedTicker}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        setStats(data as TradeStats);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (startDate && endDate) {
      fetchStats();
    }
  }, [baseUrl, startDate, endDate, selectedTicker]);
  
  // Simple spinner component as fallback
  const SimpleSpinner = () => (
    <div 
      style={{
        display: 'inline-block',
        width: '30px',
        height: '30px',
        border: '3px solid rgba(0, 0, 0, 0.1)',
        borderRadius: '50%',
        borderTopColor: '#767676',
        animation: 'spin 1s ease-in-out infinite'
      }}
    />
  );
  
  return (
    <div className="stats-page">
      <h1>Trading Statistics</h1>
      
      <div className="stats-controls">
        <div className="controls-row">
          <div className="control-group">
            <label htmlFor="timeframe">Timeframe:</label>
            <select
              id="timeframe"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          
          {timeframe === 'custom' && (
            <>
              <div className="control-group">
                <label htmlFor="startDate">Start Date:</label>
                <input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="control-group">
                <label htmlFor="endDate">End Date:</label>
                <input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </>
          )}
          
          <div className="control-group">
            <label htmlFor="ticker">Ticker:</label>
            <select
              id="ticker"
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value)}
            >
              <option value="all">All Tickers</option>
              {tickers.map((ticker) => (
                <option key={ticker.id} value={ticker.id}>
                  {ticker.symbol} - {ticker.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="loading-container">
          <SimpleSpinner />
        </div>
      ) : stats ? (
        <div className="stats-container">
          <div className="stats-section">
            <h2>Performance Overview</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Trades</h3>
                <p className="stat-value">{stats.totalTrades}</p>
              </div>
              <div className="stat-card">
                <h3>Win Rate</h3>
                <p className="stat-value">{stats.battingAverage?.toFixed(2)}%</p>
              </div>
              <div className="stat-card">
                <h3>Profit Factor</h3>
                <p className="stat-value">{stats.profitFactor?.toFixed(2)}</p>
              </div>
              <div className="stat-card">
                <h3>Expectancy</h3>
                <p className="stat-value">{stats.expectancy?.toFixed(2)}%</p>
              </div>
            </div>
          </div>
          
          <div className="stats-section">
            <h2>Win/Loss Statistics</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Winning Trades</h3>
                <p className="stat-value">{stats.winningTrades}</p>
              </div>
              <div className="stat-card">
                <h3>Losing Trades</h3>
                <p className="stat-value">{stats.losingTrades}</p>
              </div>
              <div className="stat-card">
                <h3>Avg. Win</h3>
                <p className="stat-value">{stats.averageWinPercent?.toFixed(2)}%</p>
              </div>
              <div className="stat-card">
                <h3>Avg. Loss</h3>
                <p className="stat-value">{stats.averageLossPercent?.toFixed(2)}%</p>
              </div>
              <div className="stat-card">
                <h3>Max Win</h3>
                <p className="stat-value">{stats.maxGainPercent?.toFixed(2)}%</p>
              </div>
              <div className="stat-card">
                <h3>Max Loss</h3>
                <p className="stat-value">{stats.maxLossPercent?.toFixed(2)}%</p>
              </div>
              <div className="stat-card">
                <h3>Win/Loss Ratio</h3>
                <p className="stat-value">{stats.winLossRatio?.toFixed(2)}</p>
              </div>
              <div className="stat-card">
                <h3>Avg. R-Ratio</h3>
                <p className="stat-value">{stats.averageRRatio?.toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          <div className="stats-section">
            <h2>Time Statistics</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Avg. Days (Winners)</h3>
                <p className="stat-value">{stats.averageDaysHeldWinners?.toFixed(1)}</p>
              </div>
              <div className="stat-card">
                <h3>Avg. Days (Losers)</h3>
                <p className="stat-value">{stats.averageDaysHeldLosers?.toFixed(1)}</p>
              </div>
            </div>
          </div>
          
          <div className="stats-section">
            <h2>Total Results</h2>
            <div className="stats-grid">
              <div className="stat-card total-profit-loss">
                <h3>Total P/L</h3>
                <p className={`stat-value ${stats.totalProfitLoss >= 0 ? 'profit' : 'loss'}`}>
                  ${stats.totalProfitLoss?.toFixed(2)}
                </p>
              </div>
              <div className="stat-card">
                <h3>Total P/L %</h3>
                <p className={`stat-value ${stats.totalProfitLossPercent >= 0 ? 'profit' : 'loss'}`}>
                  {stats.totalProfitLossPercent?.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="no-data">
          <p>No trade data available for the selected period.</p>
        </div>
      )}
      
      <style jsx>{`
        .stats-page {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .stats-controls {
          margin-bottom: 30px;
          background-color: #f7f7f7;
          padding: 15px;
          border-radius: 5px;
        }
        
        .controls-row {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
        }
        
        .control-group {
          display: flex;
          flex-direction: column;
          min-width: 150px;
        }
        
        .control-group label {
          margin-bottom: 5px;
          font-weight: 500;
        }
        
        .control-group select,
        .control-group input {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        
        .loading-container {
          display: flex;
          justify-content: center;
          padding: 50px 0;
        }
        
        .stats-section {
          margin-bottom: 30px;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }
        
        .stat-card {
          background-color: #fff;
          border: 1px solid #e0e0e0;
          border-radius: 5px;
          padding: 15px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .stat-card h3 {
          margin: 0 0 10px 0;
          font-size: 14px;
          color: #666;
        }
        
        .stat-value {
          font-size: 24px;
          font-weight: 600;
          margin: 0;
        }
        
        .profit {
          color: #4CAF50;
        }
        
        .loss {
          color: #FF5252;
        }
        
        .total-profit-loss {
          grid-column: span 2;
        }
        
        .no-data {
          text-align: center;
          padding: 50px 0;
          color: #666;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}