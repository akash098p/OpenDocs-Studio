import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '@layouts/AppLayout'
import { Button } from '@components/ui/Button'
import { useFileManagerStore } from '@store/fileManagerStore'
import { useUIStore } from '@store/uiStore'

interface Slide {
  id: string
  title: string
  content: string
}

export const PresentationEditorPage: React.FC = () => {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { documents } = useFileManagerStore()
  const { addNotification } = useUIStore()
  const [slides, setSlides] = useState<Slide[]>([
    { id: '1', title: 'Slide 1', content: 'Click to add content' },
  ])
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)

  const document = documents.find((doc) => doc.id === documentId)
  const currentSlide = slides[currentSlideIndex]

  useEffect(() => {
    if (!document) {
      addNotification({
        type: 'error',
        message: 'Presentation not found.',
      })
      navigate('/files')
    }
  }, [document, navigate, addNotification])

  const handleAddSlide = () => {
    const newSlide: Slide = {
      id: Math.random().toString(),
      title: `Slide ${slides.length + 1}`,
      content: 'Click to add content',
    }
    setSlides([...slides, newSlide])
    setCurrentSlideIndex(slides.length)
    addNotification({
      type: 'success',
      message: 'New slide added.',
    })
  }

  const handleUpdateSlide = (title: string, content: string) => {
    const newSlides = [...slides]
    newSlides[currentSlideIndex] = {
      ...currentSlide,
      title,
      content,
    }
    setSlides(newSlides)
  }

  const handleDeleteSlide = () => {
    if (slides.length <= 1) {
      addNotification({
        type: 'warning',
        message: 'Cannot delete the last slide.',
      })
      return
    }

    const newSlides = slides.filter((_, index) => index !== currentSlideIndex)
    setSlides(newSlides)
    setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))
    addNotification({
      type: 'success',
      message: 'Slide deleted.',
    })
  }

  const handleSave = () => {
    addNotification({
      type: 'success',
      message: 'Presentation saved.',
    })
  }

  if (!document) {
    return (
      <Layout title="Presentation Editor">
        <div className="flex items-center justify-center p-12">
          <p>Presentation not found</p>
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
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Presentation Editor</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/files')}>
              Close
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr_200px]">
          <div className="rounded-lg border border-slate-200 bg-white/70 dark:bg-slate-950/70 backdrop-blur-sm p-4 dark:border-slate-700">
            <p className="text-sm font-semibold mb-3">Slides ({slides.length})</p>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  onClick={() => setCurrentSlideIndex(index)}
                  className={`w-full rounded p-2 text-left text-xs transition-colors ${
                    index === currentSlideIndex
                      ? 'bg-orange-500 text-white dark:bg-primary-500'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {slide.title}
                </button>
              ))}
            </div>
            <Button size="sm" className="w-full mt-3" onClick={handleAddSlide}>
              Add Slide
            </Button>
          </div>

          <div className="rounded-lg border-2 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 aspect-video flex flex-col justify-between p-8">
            <div>
              <input
                type="text"
                value={currentSlide?.title || ''}
                onChange={(e) => handleUpdateSlide(e.target.value, currentSlide?.content || '')}
                className="text-3xl font-bold w-full bg-transparent border-0 focus:outline-none mb-4"
                placeholder="Slide Title"
              />
              <textarea
                value={currentSlide?.content || ''}
                onChange={(e) => handleUpdateSlide(currentSlide?.title || '', e.target.value)}
                className="w-full bg-transparent border-0 focus:outline-none resize-none flex-1 text-base"
                placeholder="Click to add content"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white/70 dark:bg-slate-950/70 backdrop-blur-sm p-4 dark:border-slate-700">
            <p className="text-sm font-semibold mb-3">Actions</p>
            <div className="space-y-2">
              <Button
                size="sm"
                className="w-full"
                onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                disabled={currentSlideIndex === 0}
              >
                ← Previous
              </Button>
              <Button
                size="sm"
                className="w-full"
                onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))}
                disabled={currentSlideIndex === slides.length - 1}
              >
                Next →
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="w-full"
                onClick={handleDeleteSlide}
              >
                Delete Slide
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
