// Type declarations for gifenc (the package ships without bundled types).
declare module 'gifenc' {
  export type Format = 'rgb565' | 'rgb444' | 'rgba4444'

  export interface QuantizeOptions {
    format?: Format
    oneBitAlpha?: boolean | number
    clearAlpha?: boolean
    clearAlphaThreshold?: number
    clearAlphaColor?: number
  }

  export interface WriteFrameOpts {
    palette?: number[][]
    first?: boolean
    transparent?: boolean
    transparentIndex?: number
    delay?: number
    repeat?: number
    dispose?: number
  }

  export interface GIFEncoderStream {
    writeFrame(index: Uint8Array, width: number, height: number, ops?: WriteFrameOpts): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
    writeHeader(): void
    reset(): void
    buffer: ArrayBuffer
    stream: unknown
  }

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: QuantizeOptions,
  ): number[][]
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: Format,
  ): Uint8Array
  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): GIFEncoderStream
}