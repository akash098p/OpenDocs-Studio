import { ToolFile, ToolOutput, ToolParams } from './types'
import { canvasToBlob, getFiles, loadImage, makeZip, mimeFor, stringParam } from './helpers'
import { outputName, Progress } from './imageProcessors'

// AI Background Eraser — runs the @imgly/background-removal ISNet matting model
// fully on-device via ONNX Runtime Web. All runtime resources (wasm builds +
// models) are self-hosted from /models/background-removal/ — fetch them with
// `npm run fetch:models` — so the tool works offline and nothing is uploaded.

export const imageRemoveBackground = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const images = getFiles(files, 'image')
  if (!images.length) throw new Error('Provide at least one image.')

  // The lib's config type expects the internal model names; 'isnet_fp16' is the
  // default medium model (best quality), 'isnet_quint8' the quantized small one.
  const model = stringParam(params, 'model', 'medium (best quality)').startsWith('small') ? 'isnet_quint8' : 'isnet_fp16'
  const outputExt = stringParam(params, 'outputFormat', 'png') === 'webp' ? 'webp' : 'png'
  const background = stringParam(params, 'background', 'transparent')
  const backgroundColor = stringParam(params, 'backgroundColor', '#FFFFFF')
  const mime = mimeFor(outputExt)

  // The heavy AI bundle is dynamically imported — it never lands in the main chunk.
  const { removeBackground } = await import('@imgly/background-removal')
  // The library joins resource paths with `new URL(..., publicPath)`, which needs
  // an absolute base. Resolve from the app origin + Vite base path — NOT from
  // document.baseURI, which in a client-routed SPA contains the current route
  // (e.g. /tools/...) and would make the model fetch hit the SPA fallback.
  const publicPath = `${window.location.origin}${import.meta.env.BASE_URL}models/background-removal/`

  const outputs: ToolOutput[] = []
  for (let i = 0; i < images.length; i += 1) {
    const file = images[i]
    const basePct = Math.round((i / images.length) * 90) + 5
    onProgress?.(basePct, `Removing background ${i + 1}/${images.length}…`)

    // device: 'gpu' uses WebGPU when available and falls back to WASM CPU otherwise.
    const result = await removeBackground(file.blob, {
      publicPath,
      model,
      device: 'gpu',
      output: { format: outputExt === 'webp' ? 'image/webp' : 'image/png', quality: 0.9 },
      progress: (key, current, total) => {
        const pct = total > 0 ? Math.round((current / total) * 100) : 0
        const label = key.startsWith('fetch') ? 'Preparing AI model…' : 'Removing background…'
        onProgress?.(Math.min(95, basePct + Math.round(pct * 0.55)), `${label} ${pct}%`)
      },
    })

    let blob = result
    if (background !== 'transparent') {
      // Composite the cutout over the requested backdrop color.
      const color = background === 'white' ? '#FFFFFF' : background === 'black' ? '#000000' : backgroundColor
      const image = await loadImage(result)
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not create canvas context.')
      ctx.fillStyle = color
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0)
      blob = await canvasToBlob(canvas, mime, outputExt === 'webp' ? 0.92 : undefined)
    }

    outputs.push({ name: outputName(file, 'cutout', outputExt), blob })
  }

  onProgress?.(100, 'Done.')
  return outputs.length === 1 ? outputs : [{ name: 'cutout-images.zip', blob: await makeZip(outputs) }]
}