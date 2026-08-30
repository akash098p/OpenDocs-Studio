// Downloads the @imgly/background-removal runtime resources (ONNX Runtime wasm
// builds + ISNet matting models) from the official CDN into
// public/models/background-removal/ so the Background Eraser tool runs fully
// offline with zero third-party requests.
//
// The "large" fp32 model (~176 MB) is intentionally skipped — the tool offers
// small (fast) and medium (best quality) only.
//
// Usage: npm run fetch:models   (safe to re-run — already-downloaded files are kept)

import { mkdir, writeFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'

const PUBLIC_PATH = 'public/models/background-removal'
const CDN = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist'
const CONCURRENCY = 3

const WANTED = new Set([
  '/onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm',
  '/onnxruntime-web/ort-wasm-simd-threaded.wasm',
  '/onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs',
  '/onnxruntime-web/ort-wasm-simd-threaded.mjs',
  '/models/isnet_quint8',
  '/models/isnet_fp16',
])

const exists = (path) => access(path, constants.F_OK).then(() => true, () => false)

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(dest, buf)
  return buf.length
}

const manifest = await (await fetch(`${CDN}/resources.json`)).json()
await mkdir(PUBLIC_PATH, { recursive: true })
await writeFile(`${PUBLIC_PATH}/resources.json`, JSON.stringify(manifest, null, 2))
console.log('resources.json written')

const chunkNames = []
for (const [key, entry] of Object.entries(manifest)) {
  if (!WANTED.has(key)) continue
  for (const chunk of entry.chunks) chunkNames.push(chunk.name)
}
const unique = [...new Set(chunkNames)]
console.log(`${unique.length} chunk files to fetch for ${WANTED.size} resources`)

const queue = [...unique]
let done = 0
let totalBytes = 0

async function worker(id) {
  while (queue.length > 0) {
    const name = queue.shift()
    const dest = `${PUBLIC_PATH}/${name}`
    if (await exists(dest)) {
      done += 1
      console.log(`[worker ${id}] (${done}/${unique.length}) cached ${name}`)
      continue
    }
    const bytes = await download(`${CDN}/${name}`, dest)
    done += 1
    totalBytes += bytes
    console.log(`[worker ${id}] (${done}/${unique.length}) ${name} (${(bytes / 1048576).toFixed(1)} MB)`)
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)))
console.log(`DONE: ${done} files, ${(totalBytes / 1048576).toFixed(1)} MB downloaded this run`)