import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useUIStore } from '@store/uiStore'
import { ToastContainer } from '@components/ui/Toast'

// Pages
import { DashboardPage } from '@pages/DashboardPage'
import { FilesPage } from '@pages/FilesPage'
import { WorkspacePage } from '@pages/WorkspacePage'
import { ToolsPage, ToolDetailPage } from '@pages/ToolsPage'
import { DocumentViewerPage } from '@pages/DocumentViewerPage'
import { DocumentEditorPage } from '@pages/DocumentEditorPage'
import { ImageEditorPage } from '@pages/ImageEditorPage'
import { SpreadsheetEditorPage } from '@pages/SpreadsheetEditorPage'
import { PresentationEditorPage } from '@pages/PresentationEditorPage'
import { PDFEditorPage } from '@pages/PDFEditorPage'

function App() {
  const { theme, notifications } = useUIStore()

  useEffect(() => {
    // Initialize theme
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/tools/:toolId" element={<ToolDetailPage />} />
          <Route path="/view/:documentId" element={<DocumentViewerPage />} />
          <Route path="/edit/text/:documentId" element={<DocumentEditorPage />} />
          <Route path="/edit/image/:documentId" element={<ImageEditorPage />} />
          <Route path="/edit/xlsx/:documentId" element={<SpreadsheetEditorPage />} />
          <Route path="/edit/pptx/:documentId" element={<PresentationEditorPage />} />
          <Route path="/edit/pdf/:documentId" element={<PDFEditorPage />} />
          <Route path="/edit/:documentId" element={<DocumentEditorPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer toasts={notifications} />
    </>
  )
}

export default App
