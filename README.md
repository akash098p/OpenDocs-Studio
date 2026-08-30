# OpenDocs Studio

**A privacy-first image & PDF toolbox that runs entirely in your browser.**

No uploads. No accounts. No tracking. OpenDocs Studio ships **17 production-ready tools** for working with images and PDFs — every operation happens locally on your device using the Canvas API, pdf-lib, pdf.js and Web Crypto. Your files never leave your machine.

| | |
|---|---|
| 🧰 **20 tools** | 11 image · 9 PDF |
| 🔒 **100% client-side** | Files are processed in-memory, never transmitted |
| 🆓 **Free for everyone** | No sign-in, no limits, no data collection |
| ⚡ **Instant** | No round-trip to a server — results download immediately |

---

## 🧰 The Tools Suite

### How it works

1. Open **Tools** in the sidebar (or navigate to `/tools`)
2. Pick a tool and drop in your file(s) — the input form is generated automatically from the tool's definition
3. Click **Run Tool** — the result downloads instantly (multi-file results are bundled into a single ZIP)

### 🖼️ Image Tools (11)

| Tool | What it does | Key options |
|---|---|---|
| **Image Resize** | Scale to exact dimensions, or fit inside a box keeping aspect ratio | Width / height (0 = auto), fit mode (stretch / fit-inside), resampling algorithm (bicubic, Lanczos, bilinear, nearest, area — mapped to the closest canvas smoothing mode; `nearest` gives true pixel-art-friendly nearest-neighbor) |
| **Image Crop** | Cut a rectangular region out of an image | Pixel-precise left / top offsets + crop width / height |
| **Image Compressor** | Shrink file size by lowering quality and/or reformatting | Format (auto / JPG / PNG / WebP), quality 1–100 (PNG is compressed via color reduction) |
| **Image Format Converter** | Clean re-encode between formats | JPG, PNG, WebP, GIF, BMP, AVIF or ICO output with quality control |
| **Add Watermark / Overlay** | Brand an image with a graphic and/or text | 9 position anchors, overlay opacity, overlay scale (% of image width), text label, font size, hex color — the overlay image is optional, so text-only watermarks work too |
| **EXIF Metadata Stripper** | Remove GPS location, camera and timestamp metadata | Re-encodes the image (metadata cannot survive re-encoding); keep the original format or convert to PNG / JPG / WebP |
| **Batch Image Renamer** | Sanitize and rename many images in one pass | Prefix, suffix, sequential numbering with zero-padding → returns a **ZIP** |
| **Custom Album Creator** | Lay multiple photos onto a printable grid canvas | Tile width / height, columns (1–12), spacing, cover / stretch tile fit, background color, output format |
| **Image Flip / Mirror** | Mirror an image horizontally or vertically (or both) | Direction (horizontal / vertical / both), output format (keep / PNG / JPG / WebP) — transparency preserved |
| **Base64 Converter** | Encode images to Base64 or decode Base64 back into a file — the mode is picked first and only the matching file slot is shown | Data-URI or raw Base64 output for HTML/CSS embedding; decoding strips data-URI prefixes / line breaks, accepts the URL-safe alphabet, and sniffs PNG / JPG / WebP / GIF / BMP / AVIF / ICO / SVG / PDF |
| **Adjustments & Enhancement** | One-pass photo tune-up with a live preview that updates as you move the compact slider bars, plus a compare-with-original toggle | Slider controls for brightness, contrast, saturation, hue, color temperature, sharpen, blur, sepia, grayscale + output format (keep / PNG / JPG / WebP) |

### 📕 PDF Tools (9)

| Tool | What it does | Key options |
|---|---|---|
| **PDF Merger** | Combine several PDFs into one document | Optional document-title metadata |
| **PDF Splitter** | Extract page ranges into separate PDFs | Ranges like `1-3,5,7-9` (bounds-checked) → returns a **ZIP** |
| **PDF Page Rotator** | Fix sideways scans | 90° / 180° / 270°, applied to all pages or a single page |
| **Images to PDF** | Turn images into a PDF, one image per page | Accepts multiple images; each page is sized to its image |
| **PDF Compressor** | Re-normalize a PDF with compressed object streams | One click — no settings needed |
| **PDF to Images** | Render every page to an image | PNG or JPG, 50–300 DPI (default 150) → returns a **ZIP** |
| **PDF Watermark** | Stamp a logo image and/or text onto every page — added as real PDF content, so the original text stays selectable | 9 position anchors, opacity, overlay scale (% of page width), text label, font, size and color; the overlay image is optional |
| **Protect PDF** | Lock a PDF with a password and set what readers may do | AES-256 (or legacy RC4), user + optional owner password, permission presets (all / read-only / no printing) |
| **Unlock PDF** | Remove a password while keeping text selectable | Enter the user or owner password; legacy AES-128 locks are unlocked by re-rendering pages |

### 🔒 Privacy by architecture

This isn't a policy promise — it's how the code works:

- Files are read with the browser **File API** and processed entirely in memory
- PDF page manipulation uses **pdf-lib**; page rendering uses **pdf.js** (`pdfjs-dist`)
- Image processing uses the **Canvas API**; EXIF data is dropped by re-encoding
- There is **no backend, no database and no analytics** on your files — once dependencies are installed, the app even works offline

### ⚙️ Adding a new tool (developer guide)

The suite is **registry-driven** — the UI builds itself from data, so a new tool needs no UI code:

1. **Define it** in `src/tools/registry.ts` — id, name, group, icon, description, file inputs (multi-file and optional inputs supported) and form fields (number / select / text with defaults, min / max / step)
2. **Implement it** as an async processor in `src/tools/imageProcessors.ts`, `imageBatchProcessors.ts` or `pdfProcessors.ts` with the signature `(files, params, onProgress) => ToolOutput[]`
3. **Dispatch it** with a single `case` in `runTool()` (`src/tools/index.ts`)

That's it — `ToolRunner.tsx` automatically renders the form, validates required inputs, shows live progress, surfaces errors as toasts, and downloads single outputs directly or bundles multi-output results as a ZIP.

## 🚀 Quick Start

**Option A — one click (Windows):** double-click `open.bat`. It installs dependencies on first run, starts the dev server if it isn't already running, and opens your browser at `http://localhost:5173`.

**Option B — manual:**

```bash
npm install
npm run dev
```

Then open **http://localhost:5173** and click **Tools** in the sidebar.

For production: `npm run build` produces a fully static site in `dist/` — deployable to any static host (Vercel, Netlify, GitHub Pages, a plain nginx box...) since there is no backend to configure.

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React 19 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| State / routing | Zustand · React Router v7 |
| PDF manipulation | pdf-lib (merge, split, rotate, compress, watermark, images → PDF) |
| PDF rendering | pdfjs-dist (PDF → canvas → PNG/JPG; legacy-lock unlock fallback) |
| PDF security | @pdfsmaller/pdf-encrypt & pdf-decrypt (AES-256 / RC4 protect + unlock via Web Crypto) |
| Bundling | JSZip (multi-file tool outputs) |
| Image processing | Canvas API |

## 📁 Project Structure

```
src/
├── tools/                      # ★ The tool engine
│   ├── registry.ts             #   All 17 tool definitions (inputs + form fields)
│   ├── types.ts                #   Shared tool contracts (ToolDefinition, ToolFile...)
│   ├── helpers.ts              #   File pickers, downloads, ZIP, param helpers
│   ├── index.ts                #   runTool() dispatcher
│   ├── imageProcessors.ts      #   resize · crop · compress · convert · watermark · EXIF
│   ├── imageBatchProcessors.ts #   batch rename · album grid
│   └── pdfProcessors.ts        #   merge · split · rotate · images→PDF · compress · render · watermark · protect · unlock
├── components/
│   ├── tools/ToolRunner.tsx    # Auto-generated tool UI (form, progress, download)
│   └── ui/ · layout/           # Reusable UI kit + Sidebar/Header
├── pages/
│   ├── ToolsPage.tsx           # Tool catalog (/tools) + runner route (/tools/:toolId)
│   └── Dashboard · Files · ... # App shell pages
└── public/tools-icons/         # One icon per tool
```

## 📄 Beyond the Tools

The same shell also includes a lightweight document workspace: a file manager with upload/search/organize, a document viewer, and basic text, image, spreadsheet, presentation and PDF editors — all browser-local, with dark mode throughout. The tools suite above is the headline feature; these editors cover quick everyday edits.

## 🧪 Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server on port 5173 |
| `npm run build` | Type-check, then production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run type-check` | TypeScript check only |
| `npm run lint` | ESLint (zero-warning policy) |

## 🐛 Troubleshooting

| Problem | Fix |
|---|---|
| Browser opens but can't connect | The dev server window (from `open.bat`) must stay open — if it was closed, run `open.bat` again |
| Port 5173 already in use | Change the port in `vite.config.ts`, or close the other Vite instance |
| Odd behavior after pulling changes | `rm -rf node_modules package-lock.json && npm install` |
| Type or lint errors | `npm run type-check` and `npm run lint` point to the exact lines |

## 📄 License

MIT — free for personal and commercial use.

## 🤝 Contributing

Contributions welcome! Tool contributions are especially easy: one registry entry + one processor function = a new tool with a full UI (see the developer guide above).

---

**20 tools · 0 uploads · 100% client-side** ✅

