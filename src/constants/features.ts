export interface AppFeature {
  id: string
  name: string
  description: string
  status: string
}

export const appFeatures: AppFeature[] = [
  {
    id: 'browse-workspace',
    name: 'Workspace dashboard',
    description: 'Review recent activity, storage status, and available tools.',
    status: 'Included',
  },
  {
    id: 'theme-preferences',
    name: 'Light and dark mode',
    description: 'Switch the interface theme and keep the preference on this device.',
    status: 'Included',
  },
  {
    id: 'file-manager',
    name: 'File manager',
    description: 'Upload, organize, search, and download stored files.',
    status: 'Included',
  },
  {
    id: 'docx-editor',
    name: 'DOCX editor',
    description: 'Create, edit, format, export, and save Word documents.',
    status: 'Included',
  },
  {
    id: 'pdf-editor',
    name: 'PDF editor',
    description: 'Annotate, draw on, and export PDFs.',
    status: 'Included',
  },
  {
    id: 'image-editor',
    name: 'Image editor',
    description: 'Draw, annotate, and export images.',
    status: 'Included',
  },
  {
    id: 'spreadsheet-editor',
    name: 'Spreadsheet editor',
    description: 'Edit tabular data and export it as CSV.',
    status: 'Included',
  },
  {
    id: 'presentation-editor',
    name: 'Presentation editor',
    description: 'Build slide-based presentations with navigation.',
    status: 'Included',
  },
]
