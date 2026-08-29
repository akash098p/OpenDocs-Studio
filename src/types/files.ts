export interface Document {
  id: string
  name: string
  type: 'pdf' | 'docx' | 'txt' | 'xlsx' | 'pptx' | 'image'
  size: number
  createdAt: string
  updatedAt: string
  ownerId: string
  folderId?: string
  shared: boolean
  views: number
  thumbnail?: string
}

export interface Folder {
  id: string
  name: string
  parentId?: string
  ownerId: string
  createdAt: string
  updatedAt: string
}

export interface FileManagerState {
  documents: Document[]
  folders: Folder[]
  currentFolderId?: string
  selectedItems: string[]
  isLoading: boolean
  error?: string
}
