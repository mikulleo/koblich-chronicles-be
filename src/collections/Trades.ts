import { CollectionConfig, PayloadRequest } from 'payload';
import { calculateTradeMetricsHook } from '../hooks/calculateTradeMetrics';
import { updateTickerTradeStatsHook } from '../hooks/updateTickerTradeStats';
import dayjs from 'dayjs';

// Define interfaces for type safety
interface ExitRecord {
  price: number | string;
  shares: number | string;
  date: string | Date;
  reason?: string;
  notes?: string;
}

export const Trades: CollectionConfig = {
  slug: 'trades',
  admin: {
    defaultColumns: ['ticker', 'type', 'entryDate', 'status', 'profitLossPercent', 'rRatio'],
    useAsTitle: 'id',
    group: 'Trading',
    listSearchableFields: ['ticker.symbol', 'notes'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'ticker',
      type: 'relationship',
      relationTo: 'tickers',
      required: true,
      admin: {
        description: 'Select the ticker symbol for this trade',
      },
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Long', value: 'long' },
        { label: 'Short', value: 'short' },
      ],
      required: true,
      defaultValue: 'long',
    },
    {
      name: 'entryDate',
      type: 'date',
      required: true,
      admin: {
        description: 'Date of trade entry',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
      defaultValue: () => new Date(),
    },
    {
      name: 'entryPrice',
      type: 'number',
      required: true,
      admin: {
        description: 'Price at entry',
        step: 0.01,
      },
    },
    {
      name: 'shares',
      type: 'number',
      required: true,
      admin: {
        description: 'Number of shares/contracts',
      },
    },
    {
      name: 'initialStopLoss',
      type: 'number',
      required: true,
      admin: {
        description: 'Initial stop loss price',
        step: 0.01,
      },
    },
    {
      name: 'modifiedStops',
      type: 'array',
      admin: {
        description: 'Track changes to stop loss',
      },
      fields: [
        {
          name: 'price',
          type: 'number',
          required: true,
          admin: {
            step: 0.01,
          },
        },
        {
          name: 'date',
          type: 'date',
          required: true,
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
          defaultValue: () => new Date(),
        },
        {
          name: 'notes',
          type: 'textarea',
        },
      ],
    },
    {
      name: 'exits',
      type: 'array',
      admin: {
        description: 'Exit details (partial or full)',
      },
      fields: [
        {
          name: 'price',
          type: 'number',
          required: true,
          admin: {
            description: 'Exit price',
            step: 0.01,
          },
        },
        {
          name: 'shares',
          type: 'number',
          required: true,
          admin: {
            description: 'Number of shares/contracts exited',
          },
        },
        {
          name: 'date',
          type: 'date',
          required: true,
          admin: {
            description: 'Date of exit',
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
          defaultValue: () => new Date(),
        },
        {
          name: 'reason',
          type: 'select',
          options: [
            { label: 'Target Reached', value: 'target' },
            { label: 'Stop Loss Hit', value: 'stop' },
            { label: 'Technical Exit', value: 'technical' },
            { label: 'Fundamental Change', value: 'fundamental' },
            { label: 'Other', value: 'other' },
          ],
        },
        {
          name: 'notes',
          type: 'textarea',
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Closed', value: 'closed' },
        { label: 'Partially Closed', value: 'partial' },
      ],
      required: true,
      defaultValue: 'open',
      admin: {
        position: 'sidebar',
        description: 'Trade status',
      },
      hooks: {
        beforeChange: [
          ({ value, siblingData }) => {
            // Auto-calculate status based on exits
            if (siblingData.exits && siblingData.exits.length > 0) {
              // Calculate total shares exited
              const totalSharesExited = siblingData.exits.reduce(
                (sum: number, exit: ExitRecord) => sum + (parseFloat(String(exit.shares)) || 0), 
                0
              );
              
              if (totalSharesExited >= siblingData.shares) {
                return 'closed';
              } else if (totalSharesExited > 0) {
                return 'partial';
              }
            }
            
            // Default or manually set value
            return value || 'open';
          }
        ],
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Trade notes and rationale',
      },
    },
    // Calculated fields
    {
      name: 'riskAmount',
      type: 'number',
      admin: {
        description: 'Calculated risk amount ($)',
        position: 'sidebar',
        readOnly: true,
        step: 0.01,
      },
    },
    {
      name: 'riskPercent',
      type: 'number',
      admin: {
        description: 'Calculated risk percentage',
        position: 'sidebar',
        readOnly: true,
        step: 0.01,
      },
    },
    {
      name: 'profitLossAmount',
      type: 'number',
      admin: {
        description: 'Profit/Loss Amount ($)',
        position: 'sidebar',
        readOnly: true,
        step: 0.01,
      },
    },
    {
      name: 'profitLossPercent',
      type: 'number',
      admin: {
        description: 'Profit/Loss Percentage',
        position: 'sidebar',
        readOnly: true,
        step: 0.01,
      },
    },
    {
      name: 'rRatio',
      type: 'number',
      admin: {
        description: 'R-Multiple (gain/loss relative to initial risk)',
        position: 'sidebar',
        readOnly: true,
        step: 0.01,
      },
    },
    {
      name: 'daysHeld',
      type: 'number',
      admin: {
        description: 'Days position has been/was held',
        position: 'sidebar',
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            // For open trades, calculate days from entry to today
            // For closed trades, calculate days from entry to last exit
            let endDate: Date;
            
            if (siblingData.status === 'closed' && siblingData.exits && siblingData.exits.length > 0) {
              // Find the latest exit date
              endDate = siblingData.exits.reduce((latest: Date, exit: ExitRecord) => {
                const exitDate = new Date(exit.date);
                return exitDate > latest ? exitDate : latest;
              }, new Date(0));
            } else {
              // For open or partially closed trades, use today
              endDate = new Date();
            }
            
            const entryDate = new Date(siblingData.entryDate);
            const diffTime = Math.abs(endDate.getTime() - entryDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            return diffDays || 0;
          }
        ],
      },
    },
  ],
  hooks: {
    beforeChange: [
      calculateTradeMetricsHook,
    ],
    afterChange: [
      updateTickerTradeStatsHook,
    ],
  },
  endpoints: [
    {
      path: '/stats',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        try {
          const startDate = req.query?.startDate as string | undefined;
          const endDate = req.query?.endDate as string | undefined;
          const tickerId = req.query?.tickerId as string | undefined;
          
          // Build the query
          const query: Record<string, any> = {
            status: {
              in: ['closed', 'partial'],
            },
          };
          
          // Add date filters if provided
          if (startDate) {
            query.entryDate = query.entryDate || {};
            query.entryDate.greater_than_equal = new Date(startDate);
          }
          
          if (endDate) {
            query.entryDate = query.entryDate || {};
            query.entryDate.less_than_equal = new Date(endDate);
          }
          
          // Add ticker filter if provided
          if (tickerId) {
            query.ticker = {
              equals: tickerId,
            };
          }
          
          // Fetch the trades
          const trades = await req.payload.find({
            collection: 'trades',
            where: query,
            limit: 1000,
          });
          
          // Calculate statistics
          const stats = calculateTradeStats(trades.docs);
          
          return Response.json(stats);
        } catch (error) {
          console.error('Error calculating trade stats:', error);
          return Response.json({ message: 'Error calculating trade statistics' }, { status: 500 });
        }
      },
    },
  ],
};

// Helper function to calculate trade statistics
function calculateTradeStats(trades: any[]) {
  // Initialize statistics
  const stats = {
    totalTrades: trades.length,
    winningTrades: 0,
    losingTrades: 0,
    breakEvenTrades: 0,
    battingAverage: 0,
    averageWinPercent: 0,
    averageLossPercent: 0,
    winLossRatio: 0,
    averageRRatio: 0,
    profitFactor: 0,
    expectancy: 0,
    averageDaysHeldWinners: 0,
    averageDaysHeldLosers: 0,
    maxGainPercent: 0,
    maxLossPercent: 0,
    maxGainLossRatio: 0,
    totalProfitLoss: 0,
    totalProfitLossPercent: 0,
  };
  
  if (trades.length === 0) {
    return stats;
  }
  
  // Calculate winning/losing trades
  const winners = trades.filter(trade => trade.profitLossPercent > 0);
  const losers = trades.filter(trade => trade.profitLossPercent < 0);
  const breakEven = trades.filter(trade => trade.profitLossPercent === 0);
  
  stats.winningTrades = winners.length;
  stats.losingTrades = losers.length;
  stats.breakEvenTrades = breakEven.length;
  
  // Calculate batting average (win rate)
  stats.battingAverage = (winners.length / trades.length) * 100;
  
  // Calculate average win/loss percentages
  stats.averageWinPercent = winners.length 
    ? winners.reduce((sum, trade) => sum + trade.profitLossPercent, 0) / winners.length
    : 0;
    
  stats.averageLossPercent = losers.length
    ? losers.reduce((sum, trade) => sum + trade.profitLossPercent, 0) / losers.length
    : 0;
  
  // Calculate win/loss ratio
  stats.winLossRatio = stats.averageLossPercent !== 0 
    ? Math.abs(stats.averageWinPercent / stats.averageLossPercent)
    : 0;
  
  // Calculate average R-ratio
  stats.averageRRatio = trades.reduce((sum, trade) => sum + (trade.rRatio || 0), 0) / trades.length;
  
  // Calculate profit factor (gross wins / gross losses)
  const grossWins = winners.reduce((sum, trade) => sum + trade.profitLossAmount, 0);
  const grossLosses = Math.abs(losers.reduce((sum, trade) => sum + trade.profitLossAmount, 0));
  stats.profitFactor = grossLosses !== 0 ? grossWins / grossLosses : 0;
  
  // Calculate expectancy
  stats.expectancy = (stats.battingAverage / 100 * stats.averageWinPercent) + 
                     ((1 - stats.battingAverage / 100) * stats.averageLossPercent);
  
  // Calculate average days held
  stats.averageDaysHeldWinners = winners.length
    ? winners.reduce((sum, trade) => sum + trade.daysHeld, 0) / winners.length
    : 0;
    
  stats.averageDaysHeldLosers = losers.length
    ? losers.reduce((sum, trade) => sum + trade.daysHeld, 0) / losers.length
    : 0;
  
  // Calculate max gain/loss
  stats.maxGainPercent = winners.length
    ? Math.max(...winners.map(trade => trade.profitLossPercent))
    : 0;
    
  stats.maxLossPercent = losers.length
    ? Math.min(...losers.map(trade => trade.profitLossPercent))
    : 0;
  
  stats.maxGainLossRatio = stats.maxLossPercent !== 0
    ? Math.abs(stats.maxGainPercent / stats.maxLossPercent)
    : 0;
  
  // Calculate total profit/loss
  stats.totalProfitLoss = trades.reduce((sum, trade) => sum + trade.profitLossAmount, 0);
  
  // Calculate weighted average profit/loss percentage
  const totalInvested = trades.reduce((sum, trade) => {
    return sum + (trade.entryPrice * trade.shares);
  }, 0);
  
  stats.totalProfitLossPercent = totalInvested !== 0
    ? (stats.totalProfitLoss / totalInvested) * 100
    : 0;
  
  return stats;
}