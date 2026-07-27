/**
 * Bulk chart importer for Koblich Chronicles.
 *
 * Usage (from koblich-chronicles-be):
 *   pnpm import-charts ./charts-inbox
 *   pnpm import-charts ./charts-inbox --dry-run
 *   pnpm import-charts ./charts-inbox --no-ai
 *   pnpm import-charts ./charts-inbox --move
 *
 * Filename convention (strict): YYYYMMDD_TICKER_timeframe[_an].(png|jpg|jpeg|webp)
 *   20260622_AAPL_daily.png      -> base chart
 *   20260622_AAPL_daily_an.png   -> annotated version, attached to the base chart above
 *
 * Metadata (notes + tags) comes from, in order of precedence:
 *   1. A sidecar markdown file next to the image (e.g. 20260622_AAPL_daily.md).
 *      Recognised headings (## ...): "Setup / Entry", "Trend", "Fundamentals",
 *      "Other", "Tags" (comma-separated). See charts-inbox/_TEMPLATE.md.
 *   2. AI vision pre-fill (Claude) — fills only the note fields the sidecar left
 *      blank, and suggests tags (preferring your existing tags). Disable with --no-ai.
 */

import path from 'path'
import fs from 'fs/promises'
import { existsSync, accessSync, constants } from 'fs'
import { fileURLToPath } from 'url'
import { getPayload } from 'payload'
import type { File, Payload } from 'payload'
import config from '@payload-config'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'intraday' | 'other'

const VALID_TIMEFRAMES: Timeframe[] = ['daily', 'weekly', 'monthly', 'intraday', 'other']
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp']

interface ParsedName {
  filename: string
  date: string // ISO yyyy-mm-dd
  symbol: string
  timeframe: Timeframe
  annotated: boolean
  baseKey: string // date_symbol_timeframe — links base + annotated
}

interface ChartNotes {
  setupEntry?: string
  trend?: string
  fundamentals?: string
  other?: string
}

interface Metadata {
  notes: ChartNotes
  tags: string[]
}

interface Options {
  dir: string
  dryRun: boolean
  useAi: boolean
  move: boolean
  createNewTags: boolean
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(): Options {
  // NOTE: `payload run` parses argv with minimist and forwards only *positional*
  // args to this script — anything starting with `--` is stripped. So flags are
  // accepted as bare words (e.g. `... charts-inbox dry-run move`) and via env vars.
  // The `--flag` forms still work when running the file directly with a TS runner.
  const argv = process.argv.slice(2)
  const positional = argv.filter((a) => !a.startsWith('--'))

  // First bare positional that isn't a known flag-word is the directory.
  const FLAG_WORDS = new Set(['dry-run', 'dry', 'no-ai', 'move', 'no-new-tags'])
  const dirArg = positional.find((a) => !FLAG_WORDS.has(a.toLowerCase()))

  const tokens = new Set(
    argv
      .map((a) => a.replace(/^--/, '').toLowerCase())
      .concat(positional.map((a) => a.toLowerCase())),
  )
  const has = (name: string, env: string) =>
    tokens.has(name) || ['1', 'true', 'yes'].includes((process.env[env] || '').toLowerCase())

  return {
    dir: path.resolve(process.cwd(), dirArg || process.env.IMPORT_DIR || 'charts-inbox'),
    dryRun: has('dry-run', 'IMPORT_DRY_RUN') || tokens.has('dry'),
    useAi: !has('no-ai', 'IMPORT_NO_AI'),
    move: has('move', 'IMPORT_MOVE'),
    createNewTags: !has('no-new-tags', 'IMPORT_NO_NEW_TAGS'),
  }
}

// ---------------------------------------------------------------------------
// Filename parsing (strict)
// ---------------------------------------------------------------------------

function parseFilename(filename: string): ParsedName | { error: string; filename: string } {
  const ext = path.extname(filename).toLowerCase()
  const stem = path.basename(filename, ext)
  const parts = stem.split('_')

  // Expect: DATE _ SYMBOL _ TIMEFRAME [ _ an ]
  const annotated = parts[parts.length - 1]?.toLowerCase() === 'an'
  const core = annotated ? parts.slice(0, -1) : parts

  if (core.length !== 3) {
    return {
      filename,
      error: `Expected YYYYMMDD_TICKER_timeframe[_an], got "${stem}"`,
    }
  }

  const [rawDate, rawSymbol, rawTimeframe] = core

  if (!/^\d{8}$/.test(rawDate)) {
    return { filename, error: `Bad date segment "${rawDate}" (need YYYYMMDD)` }
  }
  const iso = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
  if (Number.isNaN(Date.parse(iso))) {
    return { filename, error: `Invalid date "${rawDate}"` }
  }

  const timeframe = rawTimeframe.toLowerCase() as Timeframe
  if (!VALID_TIMEFRAMES.includes(timeframe)) {
    return {
      filename,
      error: `Unknown timeframe "${rawTimeframe}" (allowed: ${VALID_TIMEFRAMES.join(', ')})`,
    }
  }

  const symbol = rawSymbol.toUpperCase()

  return {
    filename,
    date: iso,
    symbol,
    timeframe,
    annotated,
    baseKey: `${rawDate}_${symbol}_${timeframe}`,
  }
}

// ---------------------------------------------------------------------------
// Sidecar markdown parsing
// ---------------------------------------------------------------------------

const HEADING_MAP: Record<string, keyof ChartNotes | 'tags'> = {
  'setup / entry': 'setupEntry',
  'setup/entry': 'setupEntry',
  setup: 'setupEntry',
  entry: 'setupEntry',
  trend: 'trend',
  fundamentals: 'fundamentals',
  other: 'other',
  tags: 'tags',
}

async function readSidecar(imagePath: string): Promise<Metadata | null> {
  const mdPath = imagePath.replace(path.extname(imagePath), '.md')
  if (!existsSync(mdPath)) return null

  const raw = await fs.readFile(mdPath, 'utf8')
  const notes: ChartNotes = {}
  let tags: string[] = []

  // Split on markdown ## headings, keep the body until the next heading.
  const sections = raw.split(/^##\s+/m).slice(1)
  for (const section of sections) {
    const newlineIdx = section.indexOf('\n')
    const heading = (newlineIdx === -1 ? section : section.slice(0, newlineIdx)).trim().toLowerCase()
    const body = (newlineIdx === -1 ? '' : section.slice(newlineIdx + 1)).trim()
    const key = HEADING_MAP[heading]
    if (!key) continue
    if (key === 'tags') {
      tags = body
        .split(/[,\n]/)
        .map((t) => t.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean)
    } else if (body) {
      notes[key] = body
    }
  }

  return { notes, tags }
}

// ---------------------------------------------------------------------------
// AI vision pre-fill
// ---------------------------------------------------------------------------

function mediaTypeFor(ext: string): string {
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  return 'image/png'
}

async function aiPrefill(
  buffer: Buffer,
  ext: string,
  symbol: string,
  timeframe: string,
  existingTags: string[],
  missing: { setupEntry: boolean; trend: boolean; fundamentals: boolean; other: boolean },
): Promise<Metadata | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('  ⚠ ANTHROPIC_API_KEY not set — skipping AI pre-fill')
    return null
  }

  // Lazy import so --no-ai / missing key paths don't require the SDK.
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const wanted = (Object.keys(missing) as (keyof typeof missing)[]).filter((k) => missing[k])

  const prompt = `You are a technical-analysis assistant looking at a ${timeframe} stock chart for ${symbol} (a MarketSurge screenshot).

Return ONLY a JSON object (no markdown, no prose) with these keys:
${wanted.map((k) => `- "${k}"`).join('\n')}
- "tags": array of short lowercase tag strings

For the note fields, write concise, factual observations (2-4 sentences each) a swing trader would jot down. Do not invent fundamentals you cannot see; if a field is not determinable from the chart, use an empty string.

For tags, strongly prefer reusing these existing tags where they apply: ${
    existingTags.length ? existingTags.join(', ') : '(none yet)'
  }. Only introduce a new tag when clearly warranted. Use chart-pattern / setup vocabulary (e.g. breakout, pullback, base, vcp, gap-up).`

  try {
    const resp = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaTypeFor(ext) as 'image/png' | 'image/jpeg' | 'image/webp',
                data: buffer.toString('base64'),
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    })

    const textBlock = resp.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null

    // Be tolerant of a stray ```json fence.
    const jsonText = textBlock.text.replace(/```json\s*|\s*```/g, '').trim()
    const parsed = JSON.parse(jsonText)

    return {
      notes: {
        setupEntry: typeof parsed.setupEntry === 'string' ? parsed.setupEntry : undefined,
        trend: typeof parsed.trend === 'string' ? parsed.trend : undefined,
        fundamentals: typeof parsed.fundamentals === 'string' ? parsed.fundamentals : undefined,
        other: typeof parsed.other === 'string' ? parsed.other : undefined,
      },
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter((t: unknown): t is string => typeof t === 'string' && t.trim() !== '')
        : [],
    }
  } catch (err) {
    console.warn(`  ⚠ AI pre-fill failed: ${(err as Error).message}`)
    return null
  }
}

// ---------------------------------------------------------------------------
// Payload upserts
// ---------------------------------------------------------------------------

async function findOrCreateTicker(payload: Payload, symbol: string): Promise<number> {
  const existing = await payload.find({
    collection: 'tickers',
    where: { symbol: { equals: symbol } },
    limit: 1,
    depth: 0,
  })
  if (existing.docs.length) return existing.docs[0].id as number

  const created = await payload.create({
    collection: 'tickers',
    data: { symbol, name: symbol }, // name is required; placeholder = symbol, enrich later
    depth: 0,
  })
  console.log(`  + created ticker ${symbol}`)
  return created.id as number
}

async function resolveTagIds(
  payload: Payload,
  names: string[],
  createNew: boolean,
): Promise<number[]> {
  const ids: number[] = []
  const seen = new Set<string>()

  for (const raw of names) {
    const name = raw.trim().toLowerCase()
    if (!name || seen.has(name)) continue
    seen.add(name)

    const existing = await payload.find({
      collection: 'tags',
      where: { name: { equals: name } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs.length) {
      ids.push(existing.docs[0].id as number)
      continue
    }
    if (!createNew) {
      console.log(`  · skipping new tag "${name}" (--no-new-tags)`)
      continue
    }
    const created = await payload.create({
      collection: 'tags',
      data: { name, color: '#9E9E9E' },
      depth: 0,
    })
    console.log(`  + created tag "${name}"`)
    ids.push(created.id as number)
  }

  return ids
}

// Returns true when the process can write to the configured uploads directory.
function uploadsLocallyWritable(): boolean {
  const dir = process.env.PAYLOAD_UPLOADS_DIR
  if (!dir) return false
  try {
    accessSync(dir, constants.W_OK)
    return true
  } catch {
    return false
  }
}

// Cached JWT token for remote uploads (fetched once per run).
let remoteToken: string | null = null

async function getRemoteToken(): Promise<string> {
  if (remoteToken) return remoteToken

  const serverUrl = process.env.PAYLOAD_SERVER_URL
  const email = process.env.PAYLOAD_ADMIN_EMAIL
  const password = process.env.PAYLOAD_ADMIN_PASS
  if (!serverUrl || !email || !password) {
    throw new Error(
      'Remote upload required but PAYLOAD_SERVER_URL, PAYLOAD_ADMIN_EMAIL, or PAYLOAD_ADMIN_PASS is not set in .env.local',
    )
  }

  const res = await fetch(`${serverUrl}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Payload login failed (${res.status}): ${body}`)
  }
  const json = (await res.json()) as { token?: string }
  if (!json.token) throw new Error('Payload login returned no token')
  remoteToken = json.token
  return remoteToken
}

async function uploadMediaViaApi(filePath: string, alt: string, sourceDate: string): Promise<number> {
  const serverUrl = process.env.PAYLOAD_SERVER_URL!
  const token = await getRemoteToken()

  const data = await fs.readFile(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const form = new FormData()
  form.append('file', new Blob([data], { type: mediaTypeFor(ext) }), path.basename(filePath))
  form.append('alt', alt)
  form.append('sourceDate', new Date(sourceDate).toISOString())

  const res = await fetch(`${serverUrl}/api/media`, {
    method: 'POST',
    headers: { Authorization: `JWT ${token}` },
    body: form,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Media API upload failed (${res.status}): ${body}`)
  }
  const json = (await res.json()) as { doc?: { id: number } }
  if (!json.doc?.id) throw new Error('Media API returned no doc.id')
  return json.doc.id
}

async function uploadMedia(
  payload: Payload,
  filePath: string,
  alt: string,
  sourceDate: string,
): Promise<number> {
  if (!uploadsLocallyWritable()) {
    return uploadMediaViaApi(filePath, alt, sourceDate)
  }

  const data = await fs.readFile(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const file: File = {
    name: path.basename(filePath),
    data,
    mimetype: mediaTypeFor(ext),
    size: data.byteLength,
  }
  const doc = await payload.create({
    collection: 'media',
    data: { alt, sourceDate: new Date(sourceDate).toISOString() },
    file,
    depth: 0,
  })
  return doc.id as number
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function mergeMetadata(sidecar: Metadata | null, ai: Metadata | null): Metadata {
  const notes: ChartNotes = { ...(sidecar?.notes ?? {}) }
  // AI only fills fields the sidecar left empty.
  for (const key of ['setupEntry', 'trend', 'fundamentals', 'other'] as (keyof ChartNotes)[]) {
    if (!notes[key] && ai?.notes[key]) notes[key] = ai.notes[key]
  }
  const tags = Array.from(
    new Set([...(sidecar?.tags ?? []), ...(ai?.tags ?? [])].map((t) => t.trim().toLowerCase())),
  ).filter(Boolean)
  return { notes, tags }
}

async function run() {
  const opts = parseArgs()
  console.log(`\nChart importer`)
  console.log(`  dir:     ${opts.dir}`)
  console.log(`  dry-run: ${opts.dryRun}`)
  console.log(`  ai:      ${opts.useAi}`)
  console.log(`  move:    ${opts.move}\n`)

  if (!existsSync(opts.dir)) {
    console.error(`Directory not found: ${opts.dir}`)
    process.exit(1)
  }

  const entries = await fs.readdir(opts.dir)
  const images = entries.filter((f) => IMAGE_EXTS.includes(path.extname(f).toLowerCase()))

  const errors: { filename: string; error: string }[] = []
  const parsed: ParsedName[] = []
  for (const f of images) {
    const result = parseFilename(f)
    if ('error' in result) errors.push(result)
    else parsed.push(result)
  }

  // Group annotated files by baseKey so we can attach them.
  const annotatedByKey = new Map<string, ParsedName>()
  for (const p of parsed) if (p.annotated) annotatedByKey.set(p.baseKey, p)

  const bases = parsed.filter((p) => !p.annotated)

  // Annotated files with no matching base = orphans (warn).
  const baseKeys = new Set(bases.map((b) => b.baseKey))
  for (const [key, ann] of annotatedByKey) {
    if (!baseKeys.has(key)) {
      errors.push({ filename: ann.filename, error: 'Annotated file has no matching base chart' })
    }
  }

  console.log(`Found ${images.length} images → ${bases.length} charts to import, ${errors.length} problem(s)\n`)

  const payload = opts.dryRun ? null : await getPayload({ config })

  // Cache existing tag names for AI prompt context (fetched once).
  let existingTagNames: string[] = []
  if (payload) {
    const tagRes = await payload.find({ collection: 'tags', limit: 1000, depth: 0 })
    existingTagNames = tagRes.docs.map((t) => String(t.name))
  }

  let imported = 0
  const processedFiles: string[] = []

  for (const base of bases) {
    const imagePath = path.join(opts.dir, base.filename)
    const ann = annotatedByKey.get(base.baseKey)
    console.log(`• ${base.filename}  (${base.symbol} ${base.timeframe} ${base.date})${ann ? `  +annotated` : ''}`)

    try {
      const sidecar = await readSidecar(imagePath)

      let ai: Metadata | null = null
      if (opts.useAi && !opts.dryRun) {
        const missing = {
          setupEntry: !sidecar?.notes.setupEntry,
          trend: !sidecar?.notes.trend,
          fundamentals: !sidecar?.notes.fundamentals,
          other: !sidecar?.notes.other,
        }
        if (Object.values(missing).some(Boolean)) {
          const buffer = await fs.readFile(imagePath)
          ai = await aiPrefill(
            buffer,
            path.extname(imagePath).toLowerCase(),
            base.symbol,
            base.timeframe,
            existingTagNames,
            missing,
          )
        }
      }

      const meta = mergeMetadata(sidecar, ai)

      if (opts.dryRun) {
        const blanks = (['setupEntry', 'trend', 'fundamentals', 'other'] as (keyof ChartNotes)[])
          .filter((k) => !meta.notes[k])
        console.log(`    sidecar notes: ${JSON.stringify(meta.notes)}`)
        console.log(`    sidecar tags:  ${meta.tags.join(', ') || '(none)'}`)
        if (opts.useAi && blanks.length) console.log(`    AI would fill: ${blanks.join(', ')} (+tag suggestions)`)
        continue
      }

      const pl = payload!
      const tickerId = await findOrCreateTicker(pl, base.symbol)
      const tagIds = await resolveTagIds(pl, meta.tags, opts.createNewTags)

      const alt = `${base.symbol} ${base.timeframe} ${base.date}`
      const imageId = await uploadMedia(pl, imagePath, alt, base.date)
      let annotatedImageId: number | undefined
      if (ann) {
        annotatedImageId = await uploadMedia(pl, path.join(opts.dir, ann.filename), `${alt} (annotated)`, base.date)
      }

      await pl.create({
        collection: 'charts',
        data: {
          image: imageId,
          ticker: tickerId,
          timestamp: new Date(base.date).toISOString(),
          timeframe: base.timeframe,
          ...(annotatedImageId ? { annotatedImage: annotatedImageId } : {}),
          ...(tagIds.length ? { tags: tagIds } : {}),
          notes: {
            setupEntry: meta.notes.setupEntry || '',
            trend: meta.notes.trend || '',
            fundamentals: meta.notes.fundamentals || '',
            other: meta.notes.other || '',
          },
        },
      })

      console.log(`    ✓ imported`)
      imported++
      processedFiles.push(base.filename)
      if (ann) processedFiles.push(ann.filename)
      const mdPath = base.filename.replace(path.extname(base.filename), '.md')
      if (existsSync(path.join(opts.dir, mdPath))) processedFiles.push(mdPath)
    } catch (err) {
      console.error(`    ✗ failed: ${(err as Error).message}`)
      errors.push({ filename: base.filename, error: (err as Error).message })
    }
  }

  // Optionally move processed files aside.
  if (opts.move && !opts.dryRun && processedFiles.length) {
    const doneDir = path.join(opts.dir, 'processed')
    await fs.mkdir(doneDir, { recursive: true })
    for (const f of processedFiles) {
      await fs.rename(path.join(opts.dir, f), path.join(doneDir, f)).catch(() => {})
    }
    console.log(`\nMoved ${processedFiles.length} file(s) to ${doneDir}`)
  }

  console.log(`\n———\nDone. Imported ${imported}/${bases.length} charts.`)
  if (errors.length) {
    console.log(`\nProblems (${errors.length}):`)
    for (const e of errors) console.log(`  - ${e.filename}: ${e.error}`)
  }

  if (payload) await payload.destroy?.()
  process.exit(errors.length ? 1 : 0)
}

// Keep a reference so ESM linters don't flag the unused import in some setups.
void fileURLToPath

// Top-level await is required: `payload run` calls process.exit(0) as soon as this
// module finishes loading, so a detached promise would be killed at the first await.
try {
  await run()
} catch (err) {
  console.error(err)
  process.exit(1)
}
