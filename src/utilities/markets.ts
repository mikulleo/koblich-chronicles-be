/**
 * Exchange/market table for tickers.
 *
 * The chart data provider (Yahoo Finance, called from the frontend's
 * /api/stock-data route) identifies non-US listings by a symbol suffix:
 * CEZ on the Prague exchange is `CEZ.PR`, SAP on XETRA is `SAP.DE`.
 *
 * A ticker therefore stores the plain symbol the way a human writes it
 * (`CEZ`) plus the market it trades on; `providerSymbol` is derived from the
 * two and is what the replay actually fetches candles with.
 *
 * `currency` is the major unit even where the exchange quotes a minor one
 * (London quotes pence, Johannesburg cents, Tel Aviv agorot) — the stock-data
 * route converts those to the major unit before charting.
 */
export interface MarketDefinition {
  /** Stored value */
  value: string
  /** Label shown in the admin dropdown */
  label: string
  /** Symbol suffix the data provider expects ('' for US) */
  suffix: string
  /** Exchange name, copied onto the ticker */
  exchange: string
  /** Trading currency, copied onto the ticker */
  currency: string
}

export const MARKETS: MarketDefinition[] = [
  { value: 'us', label: 'United States — NYSE / Nasdaq', suffix: '', exchange: 'NYSE / Nasdaq', currency: 'USD' },
  { value: 'cz', label: 'Czechia — Prague', suffix: '.PR', exchange: 'Prague Stock Exchange', currency: 'CZK' },
  { value: 'de', label: 'Germany — XETRA', suffix: '.DE', exchange: 'XETRA', currency: 'EUR' },
  { value: 'de_f', label: 'Germany — Frankfurt', suffix: '.F', exchange: 'Frankfurt', currency: 'EUR' },
  { value: 'uk', label: 'United Kingdom — London', suffix: '.L', exchange: 'London Stock Exchange', currency: 'GBP' },
  { value: 'nl', label: 'Netherlands — Amsterdam', suffix: '.AS', exchange: 'Euronext Amsterdam', currency: 'EUR' },
  { value: 'fr', label: 'France — Paris', suffix: '.PA', exchange: 'Euronext Paris', currency: 'EUR' },
  { value: 'be', label: 'Belgium — Brussels', suffix: '.BR', exchange: 'Euronext Brussels', currency: 'EUR' },
  { value: 'pt', label: 'Portugal — Lisbon', suffix: '.LS', exchange: 'Euronext Lisbon', currency: 'EUR' },
  { value: 'ie', label: 'Ireland — Dublin', suffix: '.IR', exchange: 'Euronext Dublin', currency: 'EUR' },
  { value: 'es', label: 'Spain — Madrid', suffix: '.MC', exchange: 'BME Madrid', currency: 'EUR' },
  { value: 'it', label: 'Italy — Milan', suffix: '.MI', exchange: 'Borsa Italiana', currency: 'EUR' },
  { value: 'at', label: 'Austria — Vienna', suffix: '.VI', exchange: 'Wiener Börse', currency: 'EUR' },
  { value: 'gr', label: 'Greece — Athens', suffix: '.AT', exchange: 'Athens Stock Exchange', currency: 'EUR' },
  { value: 'fi', label: 'Finland — Helsinki', suffix: '.HE', exchange: 'Nasdaq Helsinki', currency: 'EUR' },
  { value: 'se', label: 'Sweden — Stockholm', suffix: '.ST', exchange: 'Nasdaq Stockholm', currency: 'SEK' },
  { value: 'no', label: 'Norway — Oslo', suffix: '.OL', exchange: 'Oslo Børs', currency: 'NOK' },
  { value: 'dk', label: 'Denmark — Copenhagen', suffix: '.CO', exchange: 'Nasdaq Copenhagen', currency: 'DKK' },
  { value: 'ch', label: 'Switzerland — SIX', suffix: '.SW', exchange: 'SIX Swiss Exchange', currency: 'CHF' },
  { value: 'pl', label: 'Poland — Warsaw', suffix: '.WA', exchange: 'Warsaw Stock Exchange', currency: 'PLN' },
  { value: 'hu', label: 'Hungary — Budapest', suffix: '.BD', exchange: 'Budapest Stock Exchange', currency: 'HUF' },
  { value: 'tr', label: 'Turkey — Istanbul', suffix: '.IS', exchange: 'Borsa Istanbul', currency: 'TRY' },
  { value: 'ca', label: 'Canada — Toronto', suffix: '.TO', exchange: 'Toronto Stock Exchange', currency: 'CAD' },
  { value: 'ca_v', label: 'Canada — TSX Venture', suffix: '.V', exchange: 'TSX Venture Exchange', currency: 'CAD' },
  { value: 'mx', label: 'Mexico — BMV', suffix: '.MX', exchange: 'Bolsa Mexicana de Valores', currency: 'MXN' },
  { value: 'br', label: 'Brazil — B3', suffix: '.SA', exchange: 'B3 São Paulo', currency: 'BRL' },
  { value: 'jp', label: 'Japan — Tokyo', suffix: '.T', exchange: 'Tokyo Stock Exchange', currency: 'JPY' },
  { value: 'hk', label: 'Hong Kong — HKEX', suffix: '.HK', exchange: 'Hong Kong Stock Exchange', currency: 'HKD' },
  { value: 'kr', label: 'South Korea — KRX', suffix: '.KS', exchange: 'Korea Exchange', currency: 'KRW' },
  { value: 'tw', label: 'Taiwan — TWSE', suffix: '.TW', exchange: 'Taiwan Stock Exchange', currency: 'TWD' },
  { value: 'in', label: 'India — NSE', suffix: '.NS', exchange: 'National Stock Exchange of India', currency: 'INR' },
  { value: 'in_b', label: 'India — BSE', suffix: '.BO', exchange: 'Bombay Stock Exchange', currency: 'INR' },
  { value: 'sg', label: 'Singapore — SGX', suffix: '.SI', exchange: 'Singapore Exchange', currency: 'SGD' },
  { value: 'au', label: 'Australia — ASX', suffix: '.AX', exchange: 'Australian Securities Exchange', currency: 'AUD' },
  { value: 'nz', label: 'New Zealand — NZX', suffix: '.NZ', exchange: 'New Zealand Exchange', currency: 'NZD' },
  { value: 'za', label: 'South Africa — JSE', suffix: '.JO', exchange: 'Johannesburg Stock Exchange', currency: 'ZAR' },
  { value: 'il', label: 'Israel — TASE', suffix: '.TA', exchange: 'Tel Aviv Stock Exchange', currency: 'ILS' },
  { value: 'other', label: 'Other — enter suffix manually', suffix: '', exchange: '', currency: '' },
]

export const MARKET_OPTIONS = MARKETS.map(({ value, label }) => ({ value, label }))

export const DEFAULT_MARKET = 'us'

export function getMarket(value: string | null | undefined): MarketDefinition | undefined {
  return MARKETS.find((m) => m.value === value)
}

/** Suffixes sorted longest-first so '.DE' is matched before '.D' style prefixes */
const KNOWN_SUFFIXES: { suffix: string; market: string }[] = MARKETS.filter((m) => m.suffix)
  .map((m) => ({ suffix: m.suffix, market: m.value }))
  .sort((a, b) => b.suffix.length - a.suffix.length)

/** Finds the market a symbol's suffix belongs to, e.g. 'CEZ.PR' → 'cz' */
export function marketFromSymbol(symbol: string): string | undefined {
  const upper = symbol.toUpperCase()
  return KNOWN_SUFFIXES.find((s) => upper.endsWith(s.suffix))?.market
}

/** Strips a known exchange suffix, e.g. 'CEZ.PR' → 'CEZ' */
export function stripSuffix(symbol: string): string {
  const upper = symbol.trim().toUpperCase()
  const hit = KNOWN_SUFFIXES.find((s) => upper.endsWith(s.suffix))
  return hit ? upper.slice(0, -hit.suffix.length) : upper
}

/**
 * Builds the symbol the data provider needs from the plain symbol + market.
 * A symbol that already carries its suffix is left alone rather than doubled.
 */
export function buildProviderSymbol(
  symbol: string,
  market: string | null | undefined,
  customSuffix?: string | null,
): string {
  const base = stripSuffix(symbol)
  if (!base) return ''

  if (market === 'other') {
    const raw = (customSuffix ?? '').trim().toUpperCase()
    if (!raw) return base
    const suffix = raw.startsWith('.') ? raw : `.${raw}`
    return `${base}${suffix}`
  }

  const def = getMarket(market ?? DEFAULT_MARKET)
  return def?.suffix ? `${base}${def.suffix}` : base
}
