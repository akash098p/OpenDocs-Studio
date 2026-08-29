# OpenDocs Studio

A browser-based document management and editing platform similar to Google Drive + Google Docs + Canva + Adobe Acrobat, built entirely with free and open-source technologies.

## 🚀 Features (Phase 1-9 - Foundation + Core Features)

### ✅ Completed
- **Modern UI/UX** - Beautiful, responsive interface with dark mode support
- **Mobile Responsive** - Works seamlessly on desktop, tablet, and mobile
- **Theme Switcher** - Light/dark mode with persistent storage
- **Professional Layout** - Sidebar navigation with collapsible menu
- **Reusable Components** - Button, Card, Input, Toast, ThemeSwitcher, EditorToolbar
- **State Management** - Zustand for UI and file manager states
- **Routing** - React Router v7 with dynamic route handling
- **TypeScript** - Full type safety across the application
- **Tailwind CSS** - Modern, utility-first styling
- **FREE FOR ALL** - No authentication required - all features available to everyone
- **File Manager** (Phase 3) - Upload, download, organize, search, delete files
- **Document Viewer** (Phase 4) - Preview PDF, DOCX, Images, CSV with responsive layout
- **Text/DOCX Editor** (Phase 5) - Full-featured text editor with formatting toolbar (Bold, Italic, Underline, Undo, Redo)
- **PDF Editor** (Phase 6) - Annotate PDFs with drawing tools and text annotations
- **Image Editor** (Phase 7) - Canvas-based drawing with brush color and size controls
- **Spreadsheet Editor** (Phase 8) - Table-based spreadsheet editor with CSV export
- **Presentation Editor** (Phase 9) - Slide-based presentation editor with navigation
- **Image & PDF Tools Suite** - 14 privacy-first tools (resize, crop, compress, convert, watermark, EXIF strip, batch rename, album grids, PDF merge/split/rotate/compress/render) that run 100% in the browser - files never leave the device

### 📅 Upcoming Phases
- Phase 10: AI Assistant (Context-aware document suggestions)
- Phase 11: Collaboration (Real-time editing, comments)
- Phase 12: Version History (Track changes over time)
- Phase 13: Admin Panel (Content management)
- Phase 14: Testing (Unit, integration, E2E tests)
- Phase 15: Deployment (Vercel, Render, Supabase setup)

## 🛠️ Tech Stack

### Frontend
- React 19
- Vite
- TypeScript
- Tailwind CSS
- React Router v7
- Zustand

### Document Processing (all client-side)
- **pdf-lib** - PDF merge, split, rotate, compress, images-to-PDF
- **pdfjs-dist** - renders PDF pages to canvas (PDF to Images tool)
- **JSZip** - bundles multi-file tool outputs into a single ZIP download
- **jsPDF** - client-side PDF generation used by the editors
- **Canvas API** - all image processing (resize, crop, watermark, EXIF stripping)

### Deployment (Coming in Phase 15)
- Vercel (Frontend)

## 📋 Project Structure

```
src/
├── pages/              # Page components
│   ├── DashboardPage.tsx
│   ├── FilesPage.tsx
│   ├── ToolsPage.tsx       # Tool catalog + tool detail routes
│   ├── WorkspacePage.tsx
│   ├── DocumentViewerPage.tsx
│   ├── DocumentEditorPage.tsx
│   ├── ImageEditorPage.tsx
│   ├── SpreadsheetEditorPage.tsx
│   ├── PresentationEditorPage.tsx
│   └── PDFEditorPage.tsx
├── components/         # Reusable components
│   ├── ui/            # Button, Card, Input, Toast, ThemeSwitcher...
│   ├── tools/         # Registry-driven tool form UI
│   │   └── ToolRunner.tsx
│   └── layout/        # Sidebar, Header
├── tools/              # Client-side tool engine (no server, no uploads)
│   ├── registry.ts             # Tool definitions: inputs, fields, icons
│   ├── types.ts                # ToolDefinition / ToolFile / ToolOutput types
│   ├── helpers.ts              # File, canvas, param & ZIP helpers
│   ├── imageProcessors.ts      # Resize, crop, compress, convert, watermark, EXIF
│   ├── imageBatchProcessors.ts # Batch rename, album grids
│   ├── pdfProcessors.ts        # Merge, split, rotate, compress, render
│   └── index.ts                # runTool() dispatcher
├── layouts/           # AppLayout (sidebar + header shell)
├── store/             # Zustand stores (uiStore, fileManagerStore)
├── types/             # Shared TypeScript types
├── hooks/             # Custom React hooks
├── utils/             # Utility functions (cn, formatFileSize, routes)
├── constants/         # Static data (feature lists)
├── services/          # Service integrations
├── App.tsx            # Router + theme bootstrap
├── main.tsx           # Entry point
└── index.css          # Global styles

public/
└── tools-icons/       # Tool icons referenced by the registry
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository** (when available)
```bash
git clone https://github.com/yourusername/opendocs-studio.git
cd opendocs-studio
```

2. **Install dependencies**
```bash
npm install
```

3. **Start development server**
```bash
npm run dev
```

The application will open at `http://localhost:5173`

**One-click alternative (Windows):** double-click `open.bat` - it installs dependencies on first run, starts the dev server, and opens your browser at `http://localhost:5173` (reuses the running server if one is already up).

### Available Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

## 📖 Usage

### Demo Access (No Login Required)
- Visit `/dashboard` to explore the workspace immediately
- Upload and organize files in the file manager
- Preview and edit documents in the built-in editors
- Switch between light/dark themes
- View responsive design on different screen sizes

### Free Features
- **File Manager** - Upload, search, and manage documents in the browser
- **Document Viewer** - Preview documents
- **Text Editor** - Create and edit text documents with formatting tools
- **PDF Editor** - Annotate PDFs with drawing and text tools
- **Image Editor** - Draw with adjustable brush color and size
- **Spreadsheet Editor** - Edit tables and export as CSV
- **Presentation Editor** - Build slide-based presentations
- **Image & PDF Tools** - 14 utilities that process files entirely in your browser
- **Dark Mode** - Comfortable viewing in any lighting
- **Mobile Support** - Full responsive design

## 🧰 Image & PDF Tools

Open **Tools** in the sidebar (or visit `/tools`), pick a tool, drop your files, adjust the options, and download the result. Everything runs client-side via the Canvas API, pdf-lib and pdfjs-dist — **your files are never uploaded to any server**.

### Image Tools
| Tool | What it does |
|------|--------------|
| Image Resize | Scale to exact width × height or fit inside a box (aspect-ratio safe) |
| Image Crop | Cut a rectangular region by pixel offsets and size |
| Image Compressor | Shrink images via quality / format changes |
| Image Format Converter | Re-encode between JPG, PNG and WebP |
| Add Watermark / Overlay | Overlay another image and/or text branding |
| EXIF Metadata Stripper | Remove camera / location / timestamp metadata |
| Batch Image Renamer | Sanitize and rename many images at once, returned as a ZIP |
| Custom Album Creator | Lay photos out on a printable grid canvas |

### PDF Tools
| Tool | What it does |
|------|--------------|
| PDF Merger | Combine several PDFs into one document |
| PDF Splitter | Extract page ranges (e.g. `1-3,5,7-9`) as a ZIP |
| PDF Page Rotator | Rotate all pages or a single page by 90° / 180° / 270° |
| Images to PDF | Turn images into a PDF, one image per page |
| PDF Compressor | Re-normalize the PDF with compressed object streams |
| PDF to Images | Render each page to PNG or JPG (ZIP download) |

Multi-file outputs are bundled automatically into a single ZIP download.

## 🎨 Theming

The application supports both light and dark themes with automatic persistence:

```tsx
import { useUIStore } from '@store/uiStore'

export const MyComponent = () => {
  const { theme, setTheme } = useUIStore()
  
  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Toggle Theme
    </button>
  )
}
```

## 🔐 Free for Everyone

All features are completely FREE and require NO sign-in or authentication:

✅ File manager interface  
✅ Document viewer (read-only)  
✅ Dark/light mode  
✅ Mobile access  
✅ File uploads  
✅ Document editing  
✅ Image editing  
✅ Spreadsheet editing  
✅ Presentation editing  
✅ Unlimited storage (browser-based)  
✅ No data collection

## 📝 Component Documentation

### Button Component
```tsx
<Button 
  variant="primary" // 'primary' | 'secondary' | 'danger' | 'ghost'
  size="md"         // 'sm' | 'md' | 'lg'
  isLoading={false}
>
  Click Me
</Button>
```

### Card Component
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
  <CardFooter>
    Footer here
  </CardFooter>
</Card>
```

### Input Component
```tsx
<Input 
  label="Email"
  type="email"
  error="Invalid email"
  helperText="Please enter a valid email"
/>
```

## 🎯 Next Steps

After Phase 9 completion (current):

1. **Phase 10** - Implement AI Assistant
   - Context-aware suggestions
   - Auto-completion
   - Grammar checking
   - Smart formatting

2. **Phase 11** - Add Collaboration
   - Real-time co-editing with WebSockets
   - Comments and mentions
   - Activity tracking
   - Permissions management

3. **Phase 12** - Version History
   - Track all changes
   - Restore previous versions
   - Diff visualization
   - Change timeline

4. **Phase 13** - Admin Panel
   - Usage analytics
   - Content management
   - System monitoring

5. **Phase 14** - Testing Suite
   - Unit tests (Jest)
   - Integration tests
   - E2E tests (Playwright)
   - Performance testing

6. **Phase 15** - Production Deployment
   - Frontend: Vercel
   - Backend: Render (when needed)
   - Database: Supabase
   - CDN: Cloudflare

## 🐛 Troubleshooting

### Port Already in Use
If port 5173 is already in use:
```bash
PORT=3000 npm run dev
```

### Dependencies Issues
Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build Issues
```bash
npm run type-check  # Check for TypeScript errors
npm run lint        # Check for linting issues
```

## 📄 License

OpenDocs Studio is open source and licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 💬 Support

For issues, questions, or suggestions, please open an issue on GitHub.

---

**Current Phase:** 9 - Presentation Editor ✅

**Phases Completed:**
- Phase 1: Project Setup ✅
- Phase 2: Authentication (Removed - Free for all) ✅
- Phase 3: File Manager ✅
- Phase 4: Document Viewer ✅
- Phase 5: DOCX Editor ✅
- Phase 6: PDF Editor ✅
- Phase 7: Image Editor ✅
- Phase 8: Spreadsheet Editor ✅
- Phase 9: Presentation Editor ✅
- Tools Suite: 14 client-side Image & PDF tools ✅

**Next Phase:** 10 - AI Assistant (estimated: TBD)
