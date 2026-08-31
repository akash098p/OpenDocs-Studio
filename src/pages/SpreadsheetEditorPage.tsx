import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '@layouts/AppLayout'
import { Button } from '@components/ui/Button'
import { useFileManagerStore } from '@store/fileManagerStore'
import { useUIStore } from '@store/uiStore'

interface Cell {
  value: string
  edited: boolean
}

interface Row {
  [key: number]: Cell
}

export const SpreadsheetEditorPage: React.FC = () => {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { documents } = useFileManagerStore()
  const { addNotification } = useUIStore()
  const [rows, setRows] = useState<Row[]>(
    Array(10).fill(null).map(() => ({}))
  )
  const [cols] = useState(10)

  const document = documents.find((doc) => doc.id === documentId)

  useEffect(() => {
    if (!document) {
      addNotification({
        type: 'error',
        message: 'Spreadsheet not found.',
      })
      navigate('/files')
    }
  }, [document, navigate, addNotification])

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = [...rows]
    if (!newRows[rowIndex]) newRows[rowIndex] = {}
    newRows[rowIndex][colIndex] = { value, edited: true }
    setRows(newRows)
  }

  const handleSave = () => {
    addNotification({
      type: 'success',
      message: 'Spreadsheet saved.',
    })
  }

  const handleExport = () => {
    let csv = ''
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      const cells = []
      for (let c = 0; c < cols; c++) {
        cells.push(row[c]?.value || '')
      }
      csv += cells.join(',') + '\n'
    }

    const element = globalThis.document.createElement('a')
    const file = new Blob([csv], { type: 'text/csv' })
    element.href = URL.createObjectURL(file)
    element.download = `${document?.name || 'spreadsheet'}.csv`
    globalThis.document.body.appendChild(element)
    element.click()
    globalThis.document.body.removeChild(element)
    addNotification({
      type: 'success',
      message: 'Spreadsheet exported as CSV.',
    })
  }

  if (!document) {
    return (
      <Layout title="Spreadsheet Editor">
        <div className="flex items-center justify-center p-12">
          <p>Spreadsheet not found</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title={`Editing: ${document.name}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{document.name}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Spreadsheet Editor</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/files')}>
              Close
            </Button>
            <Button variant="secondary" onClick={handleExport}>
              Export as CSV
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-slate-200 bg-slate-100 p-2 text-left text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 w-12">
                  #
                </th>
                {Array(cols)
                  .fill(null)
                  .map((_, colIndex) => (
                    <th
                      key={colIndex}
                      className="border border-slate-200 bg-slate-100 p-2 text-left text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 min-w-24"
                    >
                      {String.fromCharCode(65 + colIndex)}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="border border-slate-200 bg-slate-50 p-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">
                    {rowIndex + 1}
                  </td>
                  {Array(cols)
                    .fill(null)
                    .map((_, colIndex) => (
                      <td
                        key={colIndex}
                        className="border border-slate-200 p-0 dark:border-slate-700"
                      >
                        <input
                          type="text"
                          value={row[colIndex]?.value || ''}
                          onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                          className="w-full h-10 px-2 bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-primary-500"
                          placeholder="-"
                        />
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
