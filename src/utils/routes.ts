export const getEditorRoute = (documentType: string, documentId: string): string => {
  switch (documentType) {
    case 'image':
      return `/edit/image/${documentId}`
    case 'xlsx':
      return `/edit/xlsx/${documentId}`
    case 'pptx':
      return `/edit/pptx/${documentId}`
    case 'pdf':
      return `/edit/pdf/${documentId}`
    default:
      return `/edit/text/${documentId}`
  }
}

export const getViewerRoute = (documentId: string): string => {
  return `/view/${documentId}`
}
