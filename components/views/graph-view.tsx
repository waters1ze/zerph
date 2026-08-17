'use client'

import { useApp } from '@/lib/store'
import { KnowledgeGraphModal } from '@/components/knowledge-graph-modal'
import type { Note } from '@/lib/types'

export function GraphView() {
  const { state, dispatch } = useApp()
  const { notes, tasks } = state

  const handleSelectNote = (noteId: string) => {
    localStorage.setItem('zerf_active_note_id', noteId)
    dispatch({ type: 'SET_VIEW', view: 'notes' })
    window.dispatchEvent(new CustomEvent('zerf:open_note', { detail: { noteId } }))
  }

  const handleSelectTask = (taskId: string) => {
    dispatch({ type: 'SELECT_TASK', id: taskId })
    dispatch({ type: 'SET_VIEW', view: 'tasks' })
    window.dispatchEvent(new CustomEvent('zerf:open_task', { detail: { taskId } }))
  }

  const handleCreateNoteWithTitle = (title: string) => {
    const newNote: Note = {
      id: `n-${Date.now()}`,
      title,
      content: `# ${title}\n\nСоздано из графа знаний\n\nСмотрите также: [[Планы]], [[Проекты]]\n#заметки`,
      type: 'note',
      folder: 'Общее',
      tags: ['заметки'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    dispatch({ type: 'ADD_NOTE', note: newNote })
    localStorage.setItem('zerf_active_note_id', newNote.id)
    dispatch({ type: 'SET_VIEW', view: 'notes' })
    window.dispatchEvent(new CustomEvent('zerf:open_note', { detail: { noteId: newNote.id } }))
  }

  const handleDeleteNote = (noteId: string) => {
    dispatch({ type: 'DELETE_NOTE', id: noteId })
  }

  return (
    <div className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden">
      <KnowledgeGraphModal
        isOpen={true}
        notes={notes}
        tasks={tasks}
        onSelectNote={handleSelectNote}
        onSelectTask={handleSelectTask}
        onCreateNoteWithTitle={handleCreateNoteWithTitle}
        onDeleteNote={handleDeleteNote}
        isFullView={true}
      />
    </div>
  )
}
