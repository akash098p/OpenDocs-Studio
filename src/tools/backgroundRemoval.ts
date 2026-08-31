import { ToolFile, ToolOutput, ToolParams } from './types'
import { canvasToBlob, getFiles, loadImage, makeZip, mimeFor, stringParam } from './helpers'
import { outputName, Progress } from './imageProcessors'

// AI Background Eraser — runs the @imgly/background-removal ISNet matting model
// fully on-device via ONNX Runtime Web. The image itself is never uploaded.
// Model/WASM assets are fetched on demand from IMG.LY's CDN and cached by
// the browser; processing remains entirely on the user's device.

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
  // Use the library's official CDN for the large model/WASM assets. This keeps
  // the Vercel deployment lightweight while the actual image processing remains
  // local in the browser.
  const publicPath = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/'

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