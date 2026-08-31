import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { FileManagerState, Document, Folder } from '@/types/files'

interface FileManagerStore extends FileManagerState {
  setDocuments: (documents: Document[]) => void
  setFolders: (folders: Folder[]) => void
  setCurrentFolder: (folderId?: string) => void
  setSelectedItems: (items: string[]) => void
  toggleItemSelection: (itemId: string) => void
  clearSelection: () => void
  setLoading: (isLoading: boolean) => void
  setError: (error?: string) => void
  addDocument: (document: Document) => void
  removeDocument: (id: string) => void
  updateDocument: (id: string, updates: Partial<Document>) => void
  renameDocument: (id: string, newName: string) => void
  saveDocumentContent: (id: string, content: string) => void
}

export const useFileManagerStore = create<FileManagerStore>()(
  persist(
    (set) => ({
      documents: [],
      folders: [],
      currentFolderId: undefined,
      selectedItems: [],
      isLoading: false,
      error: undefined,
      setDocuments: (documents) => set({ documents }),
      setFolders: (folders) => set({ folders }),
      setCurrentFolder: (folderId) => set({ currentFolderId: folderId }),
      setSelectedItems: (items) => set({ selectedItems: items }),
      toggleItemSelection: (itemId) =>
        set((state) => ({
          selectedItems: state.selectedItems.includes(itemId)
            ? state.selectedItems.filter((id) => id !== itemId)
            : [...state.selectedItems, itemId],
        })),
      clearSelection: () => set({ selectedItems: [] }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      addDocument: (document) =>
        set((state) => ({
          documents: [document, ...state.documents],
        })),
      removeDocument: (id) =>
        set((state) => ({
          documents: state.documents.filter((doc) => doc.id !== id),
        })),
      updateDocument: (id, updates) =>
        set((state) => ({
          documents: state.documents.map((doc) => (doc.id === id ? { ...doc, ...updates } : doc)),
        })),
      renameDocument: (id, newName) =>
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === id ? { ...doc, name: newName, updatedAt: new Date().toISOString() } : doc,
          ),
        })),
      saveDocumentContent: (id, _content) =>
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === id ? { ...doc, updatedAt: new Date().toISOString(), size: new Blob([_content]).size } : doc,
          ),
        })),
    }),
    {
      name: 'opendocs-files',
      partialize: (state) => ({
        documents: state.documents,
        folders: state.folders,
      }),
    },
  ),
)
