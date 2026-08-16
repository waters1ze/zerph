'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Download, Upload, FileText, Calendar, Check, Copy, RefreshCw,
  AlertCircle, CheckCircle, ArrowRight, Loader2, Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAuthHeaders, useApp } from '@/lib/store'

export function ImportExportSection() {
  const { state } = useApp()
  const [importFormat, setImportFormat] = useState<'csv' | 'todoist' | 'notion' | 'apple' | 'json'>('csv')
  const [importText, setImportText] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // Calendar feed state
  const [calFeedUrl, setCalFeedUrl] = useState('')
  const [webcalUrl, setWebcalUrl] = useState('')
  const [calLoading, setCalLoading] = useState(false)
  const [copiedCal, setCopiedCal] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchCalToken = async () => {
    setCalLoading(true)
    try {
      const res = await fetch('/api/calendar/token', {
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        setCalFeedUrl(data.httpsUrl || '')
        setWebcalUrl(data.webcalUrl || '')
      }
    } catch {}
    finally {
      setCalLoading(false)
    }
  }

  useEffect(() => {
    fetchCalToken()
  }, [])

  const handleExport = (format: 'json' | 'csv' | 'ics') => {
    const authHeaders = getAuthHeaders()
    const token = typeof window !== 'undefined' ? localStorage.getItem('zerf_session_token') || '' : ''
    const chatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') || '' : ''
    
    // Direct trigger download with session token in query if needed
    window.location.href = `/api/export?format=${format}&token=${token}&chatId=${chatId}`
  }

  const handleImportSubmit = async (content: string, format = importFormat) => {
    if (!content.trim()) return
    setImportLoading(true)
    setImportStatus(null)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          content,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setImportStatus({
          type: 'success',
          text: data.message || `Импортировано ${data.count} задач!`,
        })
        setImportText('')
        // Refresh page or store after 1.5s
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setImportStatus({
          type: 'error',
          text: data.error || 'Ошибка при импорте',
        })
      }
    } catch {
      setImportStatus({
        type: 'error',
        text: 'Ошибка соединения с сервером',
      })
    } finally {
      setImportLoading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        // Auto detect format from extension
        let fmt = importFormat
        if (file.name.endsWith('.json')) fmt = 'json'
        else if (file.name.toLowerCase().includes('todoist')) fmt = 'todoist'
        else if (file.name.toLowerCase().includes('notion')) fmt = 'notion'
        else if (file.name.endsWith('.csv')) fmt = 'csv'

        setImportFormat(fmt)
        handleImportSubmit(content, fmt)
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const copyCalSubscription = () => {
    if (!webcalUrl && !calFeedUrl) return
    navigator.clipboard.writeText(webcalUrl || calFeedUrl)
    setCopiedCal(true)
    setTimeout(() => setCopiedCal(false), 2500)
  }

  return (
    <div className="space-y-6 font-sans">
      {/* ── 1. Live Calendar 2-Way Subscription Feed ── */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 via-card to-card border border-blue-500/20 shadow-xs space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center font-bold">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">Синхронизация с Календарями (iCal / Webcal)</h4>
            <p className="text-xs text-muted-foreground">
              Google Календарь, Apple Календарь (iPhone / Mac), Outlook автоматически обновляют все ваши задачи и дедлайны
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <input
            type="text"
            readOnly
            value={webcalUrl || calFeedUrl || 'Генерация персональной ссылки…'}
            className="flex-1 px-3 py-2 rounded-xl bg-muted/60 border border-border text-xs text-foreground font-mono select-all focus:outline-none"
          />
          <button
            type="button"
            onClick={copyCalSubscription}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            {copiedCal ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCal ? 'Ссылка скопирована!' : 'Скопировать iCal'}</span>
          </button>
        </div>

        <div className="text-[11px] text-muted-foreground space-y-1 bg-muted/30 p-3 rounded-xl border border-border/50">
          <p className="font-semibold text-foreground">💡 Как подключить:</p>
          <p>• <b>Google Календарь:</b> Нажмите «+» рядом с «Другие календари» → «Добавить по URL» → вставьте ссылку.</p>
          <p>• <b>Apple iPhone / Mac:</b> Откройте Календарь → «Файл» → «Новая подписка на календарь» → вставьте ссылку.</p>
        </div>
      </div>

      {/* ── 2. Universal Export ── */}
      <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" />
          <span>Экспорт данных</span>
        </h4>
        <p className="text-xs text-muted-foreground">
          Скачайте ваши задачи, заметки и цели в удобном формате:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => handleExport('json')}
            className="p-3.5 rounded-xl bg-muted/40 hover:bg-muted border border-border/80 text-left transition-all cursor-pointer flex flex-col justify-between gap-1 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Резервная копия (JSON)</span>
              <FileText className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[11px] text-muted-foreground">Полный бэкап: задачи, заметки, цели, проекты</span>
          </button>

          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="p-3.5 rounded-xl bg-muted/40 hover:bg-muted border border-border/80 text-left transition-all cursor-pointer flex flex-col justify-between gap-1 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Таблица задач (CSV)</span>
              <Download className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[11px] text-muted-foreground">Для открытия в Excel, Google Таблицах или Numbers</span>
          </button>

          <button
            type="button"
            onClick={() => handleExport('ics')}
            className="p-3.5 rounded-xl bg-muted/40 hover:bg-muted border border-border/80 text-left transition-all cursor-pointer flex flex-col justify-between gap-1 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Календарь (iCal .ics)</span>
              <Calendar className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[11px] text-muted-foreground">Файл событий для импорта в любой календарь</span>
          </button>
        </div>
      </div>

      {/* ── 3. Universal Import ── */}
      <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              <span>Импорт задач из других сервисов</span>
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Перенесите список задач из Todoist, Notion, Apple Напоминаний или CSV таблицы
            </p>
          </div>
        </div>

        {/* Format Selector Pills */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'csv', label: 'Таблица CSV' },
            { id: 'todoist', label: 'Todoist (CSV)' },
            { id: 'notion', label: 'Notion (CSV)' },
            { id: 'apple', label: 'Apple Напоминания' },
            { id: 'json', label: 'Zerf JSON' },
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setImportFormat(f.id as any)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border',
                importFormat === f.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* File Drop / Select & Text input */}
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-6 rounded-2xl border-2 border-dashed border-border hover:border-primary/60 bg-muted/10 hover:bg-muted/30 transition-all text-center cursor-pointer space-y-2 group"
          >
            <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary mx-auto transition-colors" />
            <p className="text-xs font-bold text-foreground">
              Нажмите для выбора файла или перетащите его сюда (.csv, .json, .txt)
            </p>
            <p className="text-[11px] text-muted-foreground">
              Формат: {importFormat.toUpperCase()}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Или вставьте текст / строки задач напрямую:
            </label>
            <textarea
              rows={3}
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder={
                importFormat === 'apple'
                  ? "- [ ] Купить продукты #дом\n- [ ] Подготовить отчёт !!! #работа\n- Позвонить врачу в 14:00"
                  : importFormat === 'csv'
                  ? "Название,Приоритет,Дата\nПодготовить презентацию,high,2026-08-20\nСогласовать договор,medium,2026-08-21"
                  : "Вставьте содержимое файла экспорта сюда..."
              }
              className="w-full p-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {importText.trim() && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleImportSubmit(importText)}
                  disabled={importLoading}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {importLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>Импортировать введённый текст</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status Toast */}
        {importStatus && (
          <div className={cn(
            'p-4 rounded-xl text-xs font-medium border flex items-center gap-2',
            importStatus.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
          )}>
            {importStatus.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{importStatus.text}</span>
          </div>
        )}
      </div>
    </div>
  )
}
