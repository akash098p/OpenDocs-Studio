import { ToolFile, ToolOutput, ToolParams } from './types'
import {
  imageResize,
  imageCropRotate,
  imageCompress,
  imageConvert,
  addWatermark,
  imageStripExif,
  imageFlip,
  imageAdjust,
  base64Convert,
} from './imageProcessors'
import { batchRename, imageAlbum } from './imageBatchProcessors'
import {
  pdfMerge,
  pdfSplit,
  pdfRotate,
  imagesToPdf,
  pdfCompress,
  pdfToImages,
  pdfWatermark,
  pdfProtect,
  pdfUnlock,
} from './pdfProcessors'

export type Progress = (percent: number, message: string) => void

export const runTool = async (
  toolId: string,
  files: ToolFile[],
  params: ToolParams,
  onProgress?: Progress,
): Promise<ToolOutput[]> => {
  switch (toolId) {
    case 'image-resize':
      return imageResize(files, params, onProgress)    case 'image-crop-rotate':
      return imageCropRotate(files, params, onProgress)
    case 'image-compress':
      return imageCompress(files, params, onProgress)
    case 'image-convert':
      return imageConvert(files, params, onProgress)
    case 'add-watermark':
      return addWatermark(files, params, onProgress)
    case 'image-strip-exif':
      return imageStripExif(files, params, onProgress)
    case 'image-flip':
      return imageFlip(files, params, onProgress)
    case 'image-adjust':
      return imageAdjust(files, params, onProgress)
    case 'base64-converter':
      return base64Convert(files, params, onProgress)
    case 'batch-rename':
      return batchRename(files, params, onProgress)
    case 'image-album':
      return imageAlbum(files, params, onProgress)
    case 'pdf-merge':
      return pdfMerge(files, params, onProgress)
    case 'pdf-split':
      return pdfSplit(files, params, onProgress)
    case 'pdf-rotate':
      return pdfRotate(files, params, onProgress)
    case 'images-to-pdf':
      return imagesToPdf(files, params, onProgress)
    case 'pdf-compress':
      return pdfCompress(files, params, onProgress)
    case 'pdf-to-images':
      return pdfToImages(files, params, onProgress)
    case 'pdf-watermark':
      return pdfWatermark(files, params, onProgress)
    case 'pdf-protect':
      return pdfProtect(files, params, onProgress)
    case 'pdf-unlock':
      return pdfUnlock(files, params, onProgress)
    default:
      throw new Error(`Unknown tool: ${toolId}`)
  }
}