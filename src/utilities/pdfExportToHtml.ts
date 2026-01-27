import fs from 'fs/promises'
import path from 'path'
import { chromium } from 'playwright'
import { Payload } from 'payload'

interface Chart {
  id: string | number
  timestamp: string
  timeframe: string
  ticker: {
    id: string | number
    symbol: string
    name?: string
    sector?: string
  }
  tags?: Array<{ id: string | number; name: string }>
  notes?: {
    setupEntry?: string
    trend?: string
    fundamentals?: string
    other?: string
  }
  image: { url: string; filename: string }
  annotatedImage?: { url: string; filename: string }
}

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
}

export async function generateChartsPDF(charts: Chart[], _payload: Payload): Promise<Buffer> {
  // Group charts by ticker
  const grouped = new Map<string, Chart[]>()

  for (const chart of charts) {
    const ticker = chart.ticker?.symbol || 'Unknown'
    if (!grouped.has(ticker)) {
      grouped.set(ticker, [])
    }
    grouped.get(ticker)!.push(chart)
  }

  // Sort each ticker group by timestamp ascending
  for (const [, tickerCharts] of grouped) {
    tickerCharts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  // Build ordered charts list from grouped map (ticker-grouped, date-sorted)
  const orderedCharts: Chart[] = []
  for (const [, tickerCharts] of grouped) {
    orderedCharts.push(...tickerCharts)
  }

  // Generate HTML for the PDF
  const html = generateHTML(orderedCharts, grouped)

  // Determine if we should serve images from local filesystem
  const useLocalImages = process.env.PDF_USE_LOCAL_IMAGES === 'true'
  const uploadsDir = process.env.PAYLOAD_UPLOADS_DIR || '/app/uploads'

  // Launch browser and generate PDF
  const browser = await chromium.launch({
    headless: true,
  })

  const context = await browser.newContext()
  const page = await context.newPage()

  // In production, intercept image requests and serve from the local filesystem
  // instead of making HTTP requests back to the server (which is unreliable on Railway)
  if (useLocalImages) {
    await page.route('**/*', async (route) => {
      const url = route.request().url()

      // Match media file requests (e.g. .../api/media/file/image.png or .../media/image.png)
      const mediaFileMatch = url.match(/\/(?:api\/)?media\/(?:file\/)?([^/?#]+)$/)
      if (mediaFileMatch) {
        const filename = decodeURIComponent(mediaFileMatch[1]!)
        const filePath = path.join(uploadsDir, filename)

        try {
          const fileBuffer = await fs.readFile(filePath)
          const ext = path.extname(filename).toLowerCase()
          const contentType = MIME_TYPES[ext] || 'application/octet-stream'

          await route.fulfill({
            body: fileBuffer,
            contentType,
          })
          return
        } catch {
          console.warn(`[PDF] Local file not found: ${filePath}, falling back to network`)
        }
      }

      await route.continue()
    })
  }

  await page.setContent(html)
  await page.waitForLoadState('networkidle')

  const pdfBuffer = await page.pdf({
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
  })

  await browser.close()
  return Buffer.from(pdfBuffer)
}

function generateHTML(charts: Chart[], grouped: Map<string, Chart[]>): string {
  const baseUrl = process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'

  // Collect unique sectors
  const sectors = new Set<string>()
  for (const chart of charts) {
    if (chart.ticker.sector) sectors.add(chart.ticker.sector)
  }

  // Collect unique timeframes
  const timeframes = new Set<string>()
  for (const chart of charts) {
    if (chart.timeframe) timeframes.add(chart.timeframe)
  }

  // Build chart pages HTML
  let globalChartIndex = 0
  const chartPagesHtml: string[] = []

  for (const [ticker, tickerCharts] of grouped) {
    for (let i = 0; i < tickerCharts.length; i++) {
      const chart = tickerCharts[i]!
      const imageToUse = chart.annotatedImage || chart.image
      const imageUrl = imageToUse.url.startsWith('http')
        ? imageToUse.url
        : `${baseUrl}${imageToUse.url}`

      const anchorId = i === 0 ? `id="ticker-${ticker}-0"` : ''

      const hasNotes =
        chart.notes?.setupEntry ||
        chart.notes?.trend ||
        chart.notes?.fundamentals ||
        chart.notes?.other

      const hasTags = chart.tags && chart.tags.length > 0

      chartPagesHtml.push(`
      <div class="chart-page" ${anchorId}>
        <!-- Full page chart image -->
        <div class="chart-image-container">
          <img src="${imageUrl}" class="chart-image" alt="Chart for ${chart.ticker.symbol}">
        </div>

        <!-- Bottom-left: Ticker + Company name -->
        <div class="overlay overlay-bl">
          <div class="overlay-ticker">${chart.ticker.symbol}</div>
          ${chart.ticker.name ? `<div class="overlay-name">${chart.ticker.name}</div>` : ''}
        </div>

        <!-- Bottom-right: Date, timeframe, sector -->
        <div class="overlay overlay-br">
          <span class="badge badge-date">${new Date(chart.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          <span class="badge badge-timeframe">${chart.timeframe.toUpperCase()}</span>
          ${chart.ticker.sector ? `<span class="badge badge-sector">${chart.ticker.sector}</span>` : ''}
        </div>

        ${
          hasTags
            ? `
        <!-- Top-right: Tags -->
        <div class="overlay overlay-tr">
          ${chart.tags!.map((tag) => `<span class="tag-pill">${tag.name}</span>`).join('')}
        </div>
        `
            : ''
        }

        ${
          hasNotes
            ? `
        <!-- Top-left: Notes panel -->
        <div class="overlay overlay-tl">
          ${
            chart.notes!.setupEntry
              ? `<div class="note-block">
              <div class="note-label">Setup / Entry</div>
              <div class="note-text">${chart.notes!.setupEntry}</div>
            </div>`
              : ''
          }
          ${
            chart.notes!.trend
              ? `<div class="note-block">
              <div class="note-label">Trend</div>
              <div class="note-text">${chart.notes!.trend}</div>
            </div>`
              : ''
          }
          ${
            chart.notes!.fundamentals
              ? `<div class="note-block">
              <div class="note-label">Fundamentals</div>
              <div class="note-text">${chart.notes!.fundamentals}</div>
            </div>`
              : ''
          }
          ${
            chart.notes!.other
              ? `<div class="note-block">
              <div class="note-label">Other</div>
              <div class="note-text">${chart.notes!.other}</div>
            </div>`
              : ''
          }
        </div>
        `
            : ''
        }
      </div>
      `)

      globalChartIndex++
    }
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      color: #e2e8f0;
      line-height: 1.4;
      background: #0f172a;
    }

    /* ===== COVER PAGE ===== */
    .cover-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background:
        radial-gradient(ellipse at 20% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, rgba(139, 92, 246, 0.12) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 80%, rgba(14, 165, 233, 0.1) 0%, transparent 50%),
        linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
      color: white;
      page-break-after: always;
      text-align: center;
      padding: 60px;
      position: relative;
      overflow: hidden;
    }

    /* Subtle grid pattern */
    .cover-page::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
    }

    .cover-content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .cover-icon {
      font-size: 48px;
      margin-bottom: 24px;
      opacity: 0.9;
    }

    .cover-title {
      font-size: 52px;
      font-weight: 800;
      letter-spacing: -1.5px;
      margin-bottom: 12px;
      background: linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .cover-subtitle {
      font-size: 20px;
      font-weight: 300;
      color: #94a3b8;
      margin-bottom: 48px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .cover-date {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 48px;
      letter-spacing: 1px;
    }

    .cover-stats {
      display: flex;
      gap: 24px;
    }

    .stat-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 24px 36px;
      border-radius: 16px;
      backdrop-filter: blur(12px);
      min-width: 140px;
    }

    .stat-number {
      font-size: 40px;
      font-weight: 800;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1.1;
    }

    .stat-label {
      font-size: 12px;
      color: #64748b;
      margin-top: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 500;
    }

    /* ===== TABLE OF CONTENTS ===== */
    .toc-page {
      min-height: 100vh;
      padding: 48px 56px;
      background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
      page-break-after: always;
    }

    .toc-header {
      margin-bottom: 36px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .toc-title {
      font-size: 32px;
      font-weight: 700;
      color: #f8fafc;
      letter-spacing: -0.5px;
    }

    .toc-subtitle {
      font-size: 13px;
      color: #64748b;
      margin-top: 6px;
    }

    .toc-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
    }

    .toc-card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 16px 18px;
      text-decoration: none;
      color: inherit;
      transition: background 0.2s;
      display: block;
    }

    .toc-card:hover {
      background: rgba(255, 255, 255, 0.08);
    }

    .toc-symbol {
      font-size: 18px;
      font-weight: 700;
      color: #3b82f6;
      margin-bottom: 4px;
    }

    .toc-name {
      font-size: 11px;
      color: #94a3b8;
      margin-bottom: 10px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .toc-meta {
      font-size: 10px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .toc-chart-count {
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      padding: 2px 8px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 10px;
    }

    /* ===== CHART PAGES ===== */
    .chart-page {
      position: relative;
      height: 100vh;
      width: 100vw;
      page-break-after: always;
      page-break-inside: avoid;
      overflow: hidden;
      background: #0f172a;
    }

    .chart-image-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .chart-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }

    /* Glass overlay base */
    .overlay {
      position: absolute;
      z-index: 10;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      color: #f1f5f9;
    }

    /* Bottom-left: Ticker + Name */
    .overlay-bl {
      bottom: 16px;
      left: 16px;
      padding: 12px 18px;
    }

    .overlay-ticker {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #f8fafc;
      line-height: 1.1;
    }

    .overlay-name {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 2px;
      font-weight: 400;
    }

    /* Bottom-right: Date, timeframe, sector */
    .overlay-br {
      bottom: 16px;
      right: 16px;
      padding: 10px 14px;
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    .badge-date {
      background: rgba(255, 255, 255, 0.1);
      color: #e2e8f0;
    }

    .badge-timeframe {
      background: rgba(34, 197, 94, 0.2);
      color: #4ade80;
    }

    .badge-sector {
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
    }

    /* Top-right: Tags */
    .overlay-tr {
      top: 16px;
      right: 16px;
      padding: 8px 12px;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      max-width: 280px;
    }

    .tag-pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 9px;
      font-weight: 600;
      background: rgba(139, 92, 246, 0.25);
      color: #c4b5fd;
      letter-spacing: 0.3px;
    }

    /* Top-left: Notes panel */
    .overlay-tl {
      top: 16px;
      left: 16px;
      padding: 12px 14px;
      max-width: 300px;
      max-height: 220px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .note-block {
      border-left: 2px solid rgba(59, 130, 246, 0.5);
      padding-left: 8px;
    }

    .note-label {
      font-size: 9px;
      font-weight: 700;
      color: #60a5fa;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }

    .note-text {
      font-size: 9px;
      color: #cbd5e1;
      line-height: 1.4;
      word-break: break-word;
    }

    /* Scrollbar for notes */
    .overlay-tl::-webkit-scrollbar {
      width: 3px;
    }

    .overlay-tl::-webkit-scrollbar-track {
      background: transparent;
    }

    .overlay-tl::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover-page">
    <div class="cover-content">
      <div class="cover-title">Stock Chart Analysis</div>
      <div class="cover-subtitle">Trading Report</div>
      <div class="cover-date">
        Generated ${new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </div>
      <div class="cover-stats">
        <div class="stat-card">
          <div class="stat-number">${charts.length}</div>
          <div class="stat-label">Charts</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${grouped.size}</div>
          <div class="stat-label">Tickers</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${charts.filter((c) => c.annotatedImage).length}</div>
          <div class="stat-label">Annotated</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${sectors.size}</div>
          <div class="stat-label">Sectors</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Table of Contents -->
  <div class="toc-page">
    <div class="toc-header">
      <div class="toc-title">Table of Contents</div>
      <div class="toc-subtitle">${grouped.size} tickers &middot; ${charts.length} charts &middot; ${timeframes.size} timeframe${timeframes.size !== 1 ? 's' : ''}</div>
    </div>
    <div class="toc-grid">
      ${Array.from(grouped.entries())
        .map(([ticker, tickerCharts]) => {
          const firstChart = tickerCharts[0]!
          return `
        <a href="#ticker-${ticker}-0" class="toc-card">
          <div class="toc-symbol">${ticker}</div>
          <div class="toc-name">${firstChart.ticker.name || '--'}</div>
          <div class="toc-meta">
            <span class="toc-chart-count">${tickerCharts.length} chart${tickerCharts.length > 1 ? 's' : ''}</span>
            ${firstChart.ticker.sector ? `<span>${firstChart.ticker.sector}</span>` : ''}
          </div>
        </a>
      `
        })
        .join('')}
    </div>
  </div>

  <!-- Chart Pages -->
  ${chartPagesHtml.join('')}

</body>
</html>
  `
}
