'use client'

import { useApp } from '@/lib/store'
import { KnowledgeGraphModal } from '@/components/knowledge-graph-modal'
import type { Note } from '@/lib/types'

export function GraphView() {
  const { state, dispatch } = useApp()
  const { notes } = state

  const handleSelectNote = (noteId: string) => {
    dispatch({ type: 'SET_VIEW', view: 'notes' })
  }

  const handleCreateNoteWithTitle = (title: string) => {
    const newNote: Note = {
      id: `n-${Date.now()}`,
      title,
      content: `# ${title}\n\nСоздано из графа знаний`,
      type: 'note',
      folder: 'Общее',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    dispatch({ type: 'ADD_NOTE', note: newNote })
    dispatch({ type: 'SET_VIEW', view: 'notes' })
  }

  const handleDeleteNote = (noteId: string) => {
    dispatch({ type: 'DELETE_NOTE', id: noteId })
  }

  return (
    <div className="w-full h-[calc(100vh-100px)]">
      <KnowledgeGraphModal
        isOpen={true}
        notes={notes}
        onSelectNote={handleSelectNote}
        onCreateNoteWithTitle={handleCreateNoteWithTitle}
        onDeleteNote={handleDeleteNote}
        isFullView={true}
      />
    </div>
  )
}
