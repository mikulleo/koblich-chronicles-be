import { chromium } from 'playwright'
import { Payload } from 'payload'
import path from 'path'
import fs from 'fs'

// === CONFIGURATION ===
// Default to looking for local files. Set .env PDF_USE_LOCAL_IMAGES=false to force HTTP/Network mode.
const USE_LOCAL_IMAGES = process.env.PDF_USE_LOCAL_IMAGES !== 'false'

// CRITICAL: This must match the folder on the server where images are physically stored.
// On Railway, if your volume is mounted at /app/uploads, keep this.
// If your Payload config uses 'media', it might be '/app/media'.
const UPLOAD_DIR = process.env.PAYLOAD_UPLOADS_DIR || '/app/uploads'

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

export async function generateChartsPDF(charts: Chart[], _payload: Payload): Promise<Buffer> {
  console.log('--- STARTING PDF GENERATION ---')
  console.log(`[Config] USE_LOCAL_IMAGES: ${USE_LOCAL_IMAGES}`)
  console.log(`[Config] UPLOAD_DIR: ${UPLOAD_DIR}`)
  console.log(`[Config] CWD: ${process.cwd()}`)

  // Debug: Check if UPLOAD_DIR exists and list content samples
  if (fs.existsSync(UPLOAD_DIR)) {
    const files = fs.readdirSync(UPLOAD_DIR).slice(0, 5)
    console.log(`[Debug] Folder ${UPLOAD_DIR} exists. First 5 files:`, files)
  } else {
    console.error(
      `[CRITICAL] Folder ${UPLOAD_DIR} DOES NOT EXIST. Images will fail to load locally.`,
    )
  }

  const grouped = new Map<string, Chart[]>()
  for (const chart of charts) {
    const ticker = chart.ticker?.symbol || 'Unknown'
    if (!grouped.has(ticker)) {
      grouped.set(ticker, [])
    }
    grouped.get(ticker)!.push(chart)
  }

  const html = generateHTML(charts, grouped)

  console.log('Launching Headless Browser...')
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
      // ALLOW FILE ACCESS from /app/uploads
      '--allow-file-access-from-files',
      '--enable-local-file-accesses',
    ],
  })

  try {
    const context = await browser.newContext()
    const page = await context.newPage()

    // Pipe browser console logs to server terminal
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error(`[Browser Error] ${msg.text()}`)
    })

    console.log('Setting page content...')
    await page.setContent(html, {
      waitUntil: 'load',
      timeout: 120000,
    })
    console.log('Page content loaded. Printing PDF...')

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })

    console.log(`PDF Generated. Size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`)
    return pdfBuffer
  } catch (error) {
    console.error('PDF Generation Failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

function generateHTML(charts: Chart[], grouped: Map<string, Chart[]>): string {
  const sectors = new Set(charts.map((c) => c.ticker.sector).filter(Boolean))
  const timeframes = new Set(charts.map((c) => c.timeframe))

  const getImageSrc = (imageObj: { url: string; filename: string }, chartId: string | number) => {
    try {
      if (!imageObj) return ''

      // Robust Filename Extraction
      // 1. Try property 'filename'
      let filename = imageObj.filename

      // 2. If missing, try to extract from URL (e.g., /api/media/file/image.png -> image.png)
      if (!filename && imageObj.url) {
        filename = imageObj.url.split('/').pop() || ''
      }

      if (!filename) {
        console.warn(`[Chart ${chartId}] No filename found in object.`)
        return ''
      }

      // STRATEGY 1: Local File (Preferred)
      if (USE_LOCAL_IMAGES) {
        const filePath = path.join(UPLOAD_DIR, filename)

        if (fs.existsSync(filePath)) {
          return `file://${filePath}`
        } else {
          // Log only the first failure to avoid spamming
          // console.warn(`[Chart ${chartId}] File not found at: ${filePath}`)
        }
      }

      // STRATEGY 2: Fallback to HTTP URL
      // If local file fails, we try the URL.
      // Note: If running on same server, this request might time out (deadlock).
      const httpUrl = imageObj.url.startsWith('http')
        ? imageObj.url
        : `http://localhost:3000${imageObj.url}`

      return httpUrl
    } catch (e) {
      console.error(`[Chart ${chartId}] Error determining image source`, e)
      return ''
    }
  }

  // Generate HTML (Chart Pages)
  const chartPagesHtml = charts.map((chart, index) => {
    const imageToUse = chart.annotatedImage || chart.image
    const imageSrc = getImageSrc(imageToUse, chart.id)

    // Add debug info directly to the PDF if image breaks
    const imgTag = imageSrc
      ? `<img src="${imageSrc}" class="chart-image" alt="Chart" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
         <div style="display:none; color: red; padding: 20px; text-align: center;">
           FAILED TO LOAD: ${imageSrc}<br>
           Check server logs for path details.
         </div>`
      : `<div style="padding: 20px; text-align: center; color: white;">NO IMAGE SOURCE FOUND</div>`

    const anchorId = `ticker-${chart.ticker.symbol}-${index}`

    return `
      <div class="chart-page" id="${anchorId}">
        <div class="chart-image-container">
          ${imgTag}
        </div>

        ${
          chart.notes?.setupEntry ||
          chart.notes?.trend ||
          chart.notes?.fundamentals ||
          chart.notes?.other
            ? `
          <div class="overlay overlay-tl">
            ${chart.notes.setupEntry ? `<div class="note-block"><div class="note-label">Setup</div><div class="note-text">${chart.notes.setupEntry}</div></div>` : ''}
            ${chart.notes.trend ? `<div class="note-block"><div class="note-label">Trend</div><div class="note-text">${chart.notes.trend}</div></div>` : ''}
            ${chart.notes.fundamentals ? `<div class="note-block"><div class="note-label">Fundamentals</div><div class="note-text">${chart.notes.fundamentals}</div></div>` : ''}
            ${chart.notes.other ? `<div class="note-block"><div class="note-label">Notes</div><div class="note-text">${chart.notes.other}</div></div>` : ''}
          </div>
        `
            : ''
        }

        ${
          chart.tags && chart.tags.length > 0
            ? `
          <div class="overlay overlay-tr">
            ${chart.tags.map((tag) => `<span class="tag-pill">${tag.name}</span>`).join('')}
          </div>
        `
            : ''
        }

        <div class="overlay overlay-bl">
          <div class="overlay-ticker">${chart.ticker.symbol}</div>
          ${chart.ticker.name ? `<div class="overlay-name">${chart.ticker.name}</div>` : ''}
        </div>

        <div class="overlay overlay-br">
          <span class="badge badge-date">${new Date(chart.timestamp).toLocaleDateString()}</span>
          <span class="badge badge-timeframe">${chart.timeframe.toUpperCase()}</span>
          ${chart.ticker.sector ? `<span class="badge badge-sector">${chart.ticker.sector}</span>` : ''}
        </div>
      </div>
    `
  })

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #e2e8f0; line-height: 1.4; background: #0f172a; }

    /* Cover Page */
    .cover-page { height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; background: radial-gradient(ellipse at 20% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(139, 92, 246, 0.12) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(14, 165, 233, 0.1) 0%, transparent 50%), linear-gradient(180deg, #0f172a 0%, #1e293b 100%); color: white; page-break-after: always; text-align: center; padding: 60px; position: relative; overflow: hidden; }
    .cover-page::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 40px 40px; pointer-events: none; }
    .cover-content { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; }
    .cover-title { font-size: 52px; font-weight: 800; letter-spacing: -1.5px; margin-bottom: 12px; background: linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .cover-subtitle { font-size: 20px; font-weight: 300; color: #94a3b8; margin-bottom: 48px; letter-spacing: 2px; text-transform: uppercase; }
    .cover-date { font-size: 14px; color: #64748b; margin-bottom: 48px; letter-spacing: 1px; }
    .cover-stats { display: flex; gap: 24px; }
    .stat-card { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); padding: 24px 36px; border-radius: 16px; backdrop-filter: blur(12px); min-width: 140px; }
    .stat-number { font-size: 40px; font-weight: 800; background: linear-gradient(135deg, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1.1; }
    .stat-label { font-size: 12px; color: #64748b; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 500; }

    /* TOC */
    .toc-page { min-height: 100vh; padding: 48px 56px; background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%); page-break-after: always; }
    .toc-header { margin-bottom: 36px; padding-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
    .toc-title { font-size: 32px; font-weight: 700; color: #f8fafc; letter-spacing: -0.5px; }
    .toc-subtitle { font-size: 13px; color: #64748b; margin-top: 6px; }
    .toc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    .toc-card { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 16px 18px; text-decoration: none; color: inherit; transition: background 0.2s; display: block; }
    .toc-card:hover { background: rgba(255, 255, 255, 0.08); }
    .toc-symbol { font-size: 18px; font-weight: 700; color: #3b82f6; margin-bottom: 4px; }
    .toc-name { font-size: 11px; color: #94a3b8; margin-bottom: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .toc-meta { font-size: 10px; color: #64748b; display: flex; justify-content: space-between; align-items: center; }
    .toc-chart-count { background: rgba(59, 130, 246, 0.15); color: #60a5fa; padding: 2px 8px; border-radius: 6px; font-weight: 600; font-size: 10px; }

    /* Charts */
    .chart-page { position: relative; height: 100vh; width: 100vw; page-break-after: always; page-break-inside: avoid; overflow: hidden; background: #0f172a; }
    .chart-image-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    .chart-image { width: 100%; height: 100%; object-fit: contain; display: block; }
    
    /* Overlays */
    .overlay { position: absolute; z-index: 10; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; color: #f1f5f9; }
    .overlay-bl { bottom: 16px; left: 16px; padding: 12px 18px; }
    .overlay-ticker { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; color: #f8fafc; line-height: 1.1; }
    .overlay-name { font-size: 12px; color: #94a3b8; margin-top: 2px; font-weight: 400; }
    .overlay-br { bottom: 16px; right: 16px; padding: 10px 14px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 600; letter-spacing: 0.3px; }
    .badge-date { background: rgba(255, 255, 255, 0.1); color: #e2e8f0; }
    .badge-timeframe { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
    .badge-sector { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
    .overlay-tr { top: 16px; right: 16px; padding: 8px 12px; display: flex; gap: 6px; flex-wrap: wrap; max-width: 280px; }
    .tag-pill { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 9px; font-weight: 600; background: rgba(139, 92, 246, 0.25); color: #c4b5fd; letter-spacing: 0.3px; }
    .overlay-tl { top: 16px; left: 16px; padding: 12px 14px; max-width: 300px; max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
    .note-block { border-left: 2px solid rgba(59, 130, 246, 0.5); padding-left: 8px; }
    .note-label { font-size: 9px; font-weight: 700; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
    .note-text { font-size: 9px; color: #cbd5e1; line-height: 1.4; word-break: break-word; }
    .overlay-tl::-webkit-scrollbar { width: 3px; }
    .overlay-tl::-webkit-scrollbar-track { background: transparent; }
    .overlay-tl::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 3px; }
  </style>
</head>
<body>
  <div class="cover-page">
    <div class="cover-content">
      <div class="cover-title">Stock Chart Analysis</div>
      <div class="cover-subtitle">Trading Report</div>
      <div class="cover-date">
        Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
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

  <div class="toc-page">
    <div class="toc-header">
      <div class="toc-title">Table of Contents</div>
      <div class="toc-subtitle">${grouped.size} tickers &middot; ${charts.length} charts &middot; ${timeframes.size} timeframe${timeframes.size !== 1 ? 's' : ''}</div>
    </div>
    <div class="toc-grid">
      ${Array.from(grouped.entries())
        .map(([ticker, tickerCharts], i) => {
          const firstChart = tickerCharts[0]!
          return `
        <a href="#ticker-${ticker}-${i}" class="toc-card">
          <div class="toc-symbol">${ticker}</div>
          <div class="toc-name">${firstChart.ticker.name || '--'}</div>
          <div class="toc-meta">
            <span class="toc-chart-count">${tickerCharts.length} chart${tickerCharts.length > 1 ? 's' : ''}</span>
            ${firstChart.ticker.sector ? `<span>${firstChart.ticker.sector}</span>` : ''}
          </div>
        </a>`
        })
        .join('')}
    </div>
  </div>

  ${chartPagesHtml.join('')}

</body>
</html>
  `
}
