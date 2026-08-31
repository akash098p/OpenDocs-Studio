import React from 'react'
import { Button } from '@components/ui/Button'

export interface EditorToolbarProps {
  onBold: () => void
  onItalic: () => void
  onUnderline: () => void
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  onBold,
  onItalic,
  onUnderline,
  onUndo,
  onRedo,
  onSave
}) => {
  return (
    <div className="flex flex-wrap gap-1 border-b border-orange-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/70 backdrop-blur-sm p-3">
      <div className="flex gap-1 border-r border-slate-200 pr-2 dark:border-slate-700">
        <button
          type="button"
          onClick={onUndo}
          title="Undo"
          className="rounded px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-800"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={onRedo}
          title="Redo"
          className="rounded px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-800"
        >
          ↷
        </button>
      </div>

      <div className="flex gap-1 border-r border-slate-200 pr-2 dark:border-slate-700">
        <button
          type="button"
          onClick={onBold}
          title="Bold (Ctrl+B)"
          className="rounded px-2 py-1 font-bold hover:bg-slate-200 dark:hover:bg-slate-800"
        >
          B
        </button>
        <button
          type="button"
          onClick={onItalic}
          title="Italic (Ctrl+I)"
          className="rounded px-2 py-1 italic hover:bg-slate-200 dark:hover:bg-slate-800"
        >
          I
        </button>
        <button
          type="button"
          onClick={onUnderline}
          title="Underline (Ctrl+U)"
          className="rounded px-2 py-1 underline hover:bg-slate-200 dark:hover:bg-slate-800"
        >
          U
        </button>
      </div>

      <div className="flex-1 border-r border-slate-200 dark:border-slate-700" />

      <Button size="sm" onClick={onSave}>
        Save
      </Button>
    </div>
  )
}
