'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Palette, Plus, X, Check, Upload, Sliders,
  Sparkles, Trash2, Eye, Paintbrush, FileCode2,
  Copy, CheckCheck, Download, ExternalLink, Code2, Globe
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { THEME_PRESETS, normalizeTheme, type ThemePresetMeta } from '@/lib/theme-presets'

export interface CustomTheme {
  id: string
  label: string
  tagline: string
  isDark: boolean
  preview: { bg: string; surface: string; accent: string }
  variables?: Record<string, string>
  customCss?: string
  githubUrl?: string
  author?: string
  i18nOverrides?: Record<string, any>
}

export const EXTENDED_THEME_LIBRARY: Array<{
  id: string
  label: string
  tagline: string
  isDark: boolean
  preview: { bg: string; surface: string; accent: string }
  variables?: Record<string, string>
}> = [
  {
    id: 'strict',
    label: 'Strict Black',
    tagline: 'Инженерный глубокий монохром для фокусировки',
    isDark: true,
    preview: { bg: '#09090b', surface: '#18181b', accent: '#fafafa' },
  },
  {
    id: 'warm',
    label: 'Warm Gold',
    tagline: 'Тёплый чёрный с благородным шампанским золотом',
    isDark: true,
    preview: { bg: '#12100e', surface: '#1c1917', accent: '#eab308' },
  },
  {
    id: 'indigo_aura',
    label: 'Dark Indigo',
    tagline: 'Глубокий кибернетический индиго и фиолетовый акцент',
    isDark: true,
    preview: { bg: '#080816', surface: '#111129', accent: '#6366f1' },
    variables: {
      '--background': '#080816',
      '--card': '#111129',
      '--primary': '#6366f1',
      '--foreground': '#f8fafc',
      '--border': '#1e1e3f',
      '--muted': '#161633',
    }
  },
  {
    id: 'forest_emerald',
    label: 'Forest Emerald',
    tagline: 'Изумрудный ночной лес для спокойной продуктивности',
    isDark: true,
    preview: { bg: '#05140d', surface: '#0a2318', accent: '#10b981' },
    variables: {
      '--background': '#05140d',
      '--card': '#0a2318',
      '--primary': '#10b981',
      '--foreground': '#ecfdf5',
      '--border': '#143a29',
      '--muted': '#0e2b1e',
    }
  },
  {
    id: 'pure_amoled',
    label: 'Pure AMOLED',
    tagline: 'Идеально чёрный 0% пикселей для OLED дисплеев',
    isDark: true,
    preview: { bg: '#000000', surface: '#0d0d0d', accent: '#38bdf8' },
    variables: {
      '--background': '#000000',
      '--card': '#0d0d0d',
      '--primary': '#38bdf8',
      '--foreground': '#ffffff',
      '--border': '#1f1f1f',
      '--muted': '#141414',
    }
  },
  {
    id: 'rose_quartz',
    label: 'Rose Quartz',
    tagline: 'Мягкий неоновый кварц и стильный розовый штрих',
    isDark: true,
    preview: { bg: '#140810', surface: '#220e1c', accent: '#f43f5e' },
    variables: {
      '--background': '#140810',
      '--card': '#220e1c',
      '--primary': '#f43f5e',
      '--foreground': '#fff1f2',
      '--border': '#39172e',
      '--muted': '#291022',
    }
  },
  {
    id: 'blue',
    label: 'Blue Light',
    tagline: 'Светлый корпоративный, спокойный и воздушный',
    isDark: false,
    preview: { bg: '#f8fafc', surface: '#ffffff', accent: '#2563eb' },
  },
  {
    id: 'paper',
    label: 'Paper Cream',
    tagline: 'Кремовый светлый с чернильным контрастом',
    isDark: false,
    preview: { bg: '#faf8f5', surface: '#ffffff', accent: '#18181b' },
  },
]

export interface CustomThemesModalProps {
  isOpen: boolean
  onClose: () => void
  currentTheme: string
  onApplyTheme: (themeId: string, customVars?: Record<string, string>, customCss?: string, githubUrl?: string) => void
}

export function CustomThemesModal({
  isOpen,
  onClose,
  currentTheme,
  onApplyTheme,
}: CustomThemesModalProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'create' | 'css' | 'github'>('library')
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('zerf_custom_themes')
        return saved ? JSON.parse(saved) : []
      } catch {}
    }
    return []
  })

  // Create form state
  const [themeTitle, setThemeTitle] = useState('')
  const [themeDesc, setThemeDesc] = useState('')
  const [colorBg, setColorBg] = useState('#09090b')
  const [colorCard, setColorCard] = useState('#121217')
  const [colorPrimary, setColorPrimary] = useState('#6366f1')
  const [colorFg, setColorFg] = useState('#ffffff')
  const [colorBorder, setColorBorder] = useState('#27272a')
  const [colorMuted, setColorMuted] = useState('#18181b')

  // CSS Input state
  const [cssCode, setCssCode] = useState('')
  const [cssParseError, setCssParseError] = useState<string | null>(null)

  // GitHub integration states
  const [githubUrlInput, setGithubUrlInput] = useState('')
  const [githubLoading, setGithubLoading] = useState(false)
  const [githubError, setGithubError] = useState<string | null>(null)
  const [copiedFile, setCopiedFile] = useState<string | null>(null)

  const handleSaveCustomTheme = () => {
    if (!themeTitle.trim()) {
      alert('Пожалуйста, укажите название темы')
      return
    }

    const newTheme: CustomTheme = {
      id: `custom_${Date.now()}`,
      label: themeTitle.trim(),
      tagline: themeDesc.trim() || 'Пользовательская тема',
      isDark: true,
      preview: {
        bg: colorBg,
        surface: colorCard,
        accent: colorPrimary,
      },
      variables: {
        '--background': colorBg,
        '--card': colorCard,
        '--primary': colorPrimary,
        '--foreground': colorFg,
        '--border': colorBorder,
        '--muted': colorMuted,
      }
    }

    const updated = [newTheme, ...customThemes]
    setCustomThemes(updated)
    try {
      localStorage.setItem('zerf_custom_themes', JSON.stringify(updated))
    } catch {}

    onApplyTheme(newTheme.id, newTheme.variables)
    setActiveTab('library')
  }

  const handleParseAndApplyCss = () => {
    setCssParseError(null)
    if (!cssCode.trim()) {
      setCssParseError('Вставьте CSS код с переменными :root { --primary: ... }')
      return
    }

    const vars: Record<string, string> = {}
    const matches = cssCode.match(/--[\w-]+:\s*[^;]+/g)

    if (!matches || matches.length === 0) {
      setCssParseError('CSS переменные не найдены. Пример: --primary: #6366f1; --background: #000;')
      return
    }

    matches.forEach(m => {
      const [k, v] = m.split(':')
      if (k && v) {
        vars[k.trim()] = v.trim()
      }
    })

    const customName = `CSS Тема ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
    const newTheme: CustomTheme = {
      id: `custom_css_${Date.now()}`,
      label: customName,
      tagline: 'Импортировано из пользовательского CSS',
      isDark: true,
      preview: {
        bg: vars['--background'] || '#09090b',
        surface: vars['--card'] || '#121217',
        accent: vars['--primary'] || '#6366f1',
      },
      variables: vars,
    }

    const updated = [newTheme, ...customThemes]
    setCustomThemes(updated)
    try {
      localStorage.setItem('zerf_custom_themes', JSON.stringify(updated))
    } catch {}

    onApplyTheme(newTheme.id, newTheme.variables)
    setActiveTab('library')
  }

  const handleDeleteCustomTheme = (id: string) => {
    const updated = customThemes.filter(t => t.id !== id)
    setCustomThemes(updated)
    try {
      localStorage.setItem('zerf_custom_themes', JSON.stringify(updated))
    } catch {}
  }

  if (!isOpen) return null

  const allThemesList = [
    ...customThemes.map(t => ({ ...t, isCustom: true })),
    ...EXTENDED_THEME_LIBRARY,
  ]

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-foreground font-sans"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xl shrink-0 shadow-xs">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">Библиотека и создание цветовых тем</h3>
                <p className="text-[11px] text-muted-foreground">Выберите готовую тему или создайте собственный стиль интерфейса</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer touch-manipulation"
              title="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="px-4 pt-3 border-b border-border/80 flex items-center gap-2 bg-card">
            <button
              onClick={() => setActiveTab('library')}
              className={cn(
                'px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                activeTab === 'library'
                  ? 'bg-primary/15 text-primary border border-primary/30 shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Каталог тем ({allThemesList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={cn(
                'px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                activeTab === 'create'
                  ? 'bg-primary/15 text-primary border border-primary/30 shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>+ Собрать тему</span>
            </button>
            <button
              onClick={() => setActiveTab('css')}
              className={cn(
                'px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                activeTab === 'css'
                  ? 'bg-primary/15 text-primary border border-primary/30 shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>CSS & Анимации</span>
            </button>
            <button
              onClick={() => setActiveTab('github')}
              className={cn(
                'px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                activeTab === 'github'
                  ? 'bg-primary/15 text-primary border border-primary/30 shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Globe className="w-3.5 h-3.5 text-primary" />
              <span>GitHub Репозиторий</span>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {activeTab === 'library' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allThemesList.map(item => {
                  const isActive = currentTheme === item.id
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 bg-card shadow-2xs relative group',
                        isActive ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-foreground/30'
                      )}
                    >
                      <div>
                        {/* Mini Theme Preview */}
                        <div
                          className="h-16 rounded-xl border border-border/40 p-2 relative overflow-hidden flex flex-col justify-center gap-1.5 mb-2.5 shadow-inner"
                          style={{ background: item.preview.bg }}
                        >
                          <div className="h-2 w-3/4 rounded-sm" style={{ background: item.preview.surface }} />
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ background: item.preview.accent }} />
                            <div className="h-2 w-1/2 rounded-sm" style={{ background: item.preview.surface }} />
                          </div>
                          {isActive && (
                            <span
                              className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center shadow-md"
                              style={{ background: item.preview.accent }}
                            >
                              <Check className="w-3 h-3 text-white" />
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-foreground">{item.label}</h4>
                          {(item as any).isCustom && (
                            <span className="px-1.5 py-0.2 rounded-md bg-purple-500/15 text-purple-400 text-[9px] font-mono font-bold">
                              Своя
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{item.tagline}</p>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                        <button
                          onClick={() => onApplyTheme(item.id, (item as any).variables)}
                          className={cn(
                            'flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer touch-manipulation',
                            isActive
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-primary text-primary-foreground shadow-xs hover:opacity-90'
                          )}
                        >
                          {isActive ? <Check className="w-3.5 h-3.5" /> : null}
                          <span>{isActive ? 'Применена' : 'Применить'}</span>
                        </button>

                        {(item as any).isCustom && (
                          <button
                            onClick={() => handleDeleteCustomTheme(item.id)}
                            className="p-1.5 rounded-xl bg-muted/60 hover:bg-rose-500/15 text-muted-foreground hover:text-rose-400 border border-border transition-colors cursor-pointer"
                            title="Удалить свою тему"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {activeTab === 'create' && (
              <div className="space-y-4 max-w-lg mx-auto">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">Название темы</label>
                    <input
                      type="text"
                      value={themeTitle}
                      onChange={e => setThemeTitle(e.target.value)}
                      placeholder="Мой авторский стиль..."
                      className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">Краткое описание</label>
                    <input
                      type="text"
                      value={themeDesc}
                      onChange={e => setThemeDesc(e.target.value)}
                      placeholder="Тёмная тема с яркими кнопками"
                      className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground block">Фон страницы (--background)</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={colorBg} onChange={e => setColorBg(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-border" />
                      <input type="text" value={colorBg} onChange={e => setColorBg(e.target.value)} className="flex-1 h-8 px-2 rounded-lg bg-muted/40 border border-border text-xs font-mono" />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground block">Карточки и панели (--card)</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={colorCard} onChange={e => setColorCard(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-border" />
                      <input type="text" value={colorCard} onChange={e => setColorCard(e.target.value)} className="flex-1 h-8 px-2 rounded-lg bg-muted/40 border border-border text-xs font-mono" />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground block">Основной акцент (--primary)</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={colorPrimary} onChange={e => setColorPrimary(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-border" />
                      <input type="text" value={colorPrimary} onChange={e => setColorPrimary(e.target.value)} className="flex-1 h-8 px-2 rounded-lg bg-muted/40 border border-border text-xs font-mono" />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground block">Цвет текста (--foreground)</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={colorFg} onChange={e => setColorFg(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-border" />
                      <input type="text" value={colorFg} onChange={e => setColorFg(e.target.value)} className="flex-1 h-8 px-2 rounded-lg bg-muted/40 border border-border text-xs font-mono" />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveCustomTheme}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
                >
                  <Check className="w-4 h-4" />
                  <span>Сохранить и применить тему</span>
                </button>
              </div>
            )}

            {activeTab === 'css' && (
              <div className="space-y-3 max-w-lg mx-auto">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Вставьте CSS код с токенами оформления. Переменные будут автоматически извлечены и применены ко всем компонентам приложения:
                </p>
                <textarea
                  rows={6}
                  value={cssCode}
                  onChange={e => setCssCode(e.target.value)}
                  placeholder={":root {\n  --background: #080816;\n  --card: #111129;\n  --primary: #6366f1;\n  --foreground: #f8fafc;\n  --border: #1e1e3f;\n}"}
                  className="w-full p-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground font-mono outline-none focus:border-primary"
                />

                {cssParseError && (
                  <p className="text-xs text-rose-400">{cssParseError}</p>
                )}

                <button
                  type="button"
                  onClick={handleParseAndApplyCss}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
                >
                  <Upload className="w-4 h-4" />
                  <span>Импортировать CSS и применить</span>
                </button>
              </div>
            )}

            {activeTab === 'github' && (
              <div className="space-y-4 max-w-xl mx-auto">
                {/* Section 1: Import Theme from GitHub */}
                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-3">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    <h4 className="text-xs font-bold text-foreground">Импорт темы с GitHub</h4>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Введите ссылку на репозиторий GitHub или прямой URL к файлу <code className="font-mono text-primary font-bold">zerf-theme.json</code>:
                  </p>

                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={githubUrlInput}
                      onChange={e => setGithubUrlInput(e.target.value)}
                      placeholder="https://github.com/waters1ze/zerf-theme-cyberpunk"
                      className="flex-1 h-9 px-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground font-mono outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      disabled={githubLoading || !githubUrlInput.trim()}
                      onClick={async () => {
                        setGithubError(null)
                        setGithubLoading(true)
                        try {
                          let targetUrl = githubUrlInput.trim()
                          if (targetUrl.includes('github.com') && !targetUrl.includes('raw.githubusercontent.com') && !targetUrl.endsWith('.json')) {
                            const clean = targetUrl.replace(/\/$/, '')
                            targetUrl = `${clean.replace('github.com', 'raw.githubusercontent.com')}/main/zerf-theme.json`
                          }

                          const res = await fetch(targetUrl)
                          if (!res.ok) throw new Error(`HTTP ${res.status}: не удалось загрузить zerf-theme.json из ${targetUrl}`)
                          const data = await res.json()
                          const cfg = data.themeConfig || data.content || data

                          const importedTheme: CustomTheme = {
                            id: data.id || `github_${Date.now()}`,
                            label: data.title || data.label || 'GitHub Theme',
                            tagline: data.description || data.tagline || 'Импортировано с GitHub',
                            isDark: cfg.theme !== 'blue' && cfg.theme !== 'paper',
                            preview: data.preview || { bg: '#09090b', surface: '#18181b', accent: '#10b981' },
                            variables: cfg.variables,
                            customCss: cfg.customCss,
                            githubUrl: githubUrlInput.trim(),
                            author: data.author || '@github',
                            i18nOverrides: cfg.i18nOverrides,
                          }

                          const updated = [importedTheme, ...customThemes]
                          setCustomThemes(updated)
                          try {
                            localStorage.setItem('zerf_custom_themes', JSON.stringify(updated))
                          } catch {}

                          onApplyTheme(importedTheme.id, importedTheme.variables, importedTheme.customCss, importedTheme.githubUrl)
                          setActiveTab('library')
                        } catch (err: any) {
                          setGithubError(err.message || 'Ошибка загрузки темы с GitHub. Убедитесь, что репозиторий публичный и содержит zerf-theme.json.')
                        } finally {
                          setGithubLoading(false)
                        }
                      }}
                      className="px-4 h-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {githubLoading ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      <span>Импорт</span>
                    </button>
                  </div>

                  {githubError && (
                    <p className="text-xs text-rose-400 font-medium">{githubError}</p>
                  )}
                </div>

                {/* Section 2: GitHub Theme Creator & Export Kit */}
                <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-primary" />
                      <h4 className="text-xs font-bold text-foreground">Создать тему на GitHub (Экспорт)</h4>
                    </div>
                    <a
                      href="https://github.com/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Создать репозиторий</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Вы можете хостить свои темы на GitHub и делиться ими с сообществом. Скопируйте готовый манифест <code className="font-mono text-foreground font-bold">zerf-theme.json</code>:
                  </p>

                  <div className="relative">
                    <pre className="p-3 rounded-xl bg-muted/40 border border-border text-[10px] font-mono text-foreground overflow-x-auto max-h-48 leading-relaxed">
{JSON.stringify({
  name: "zerf-theme-community",
  title: "My Custom Zerf Theme",
  version: "1.0.0",
  description: "Пользовательская тема оформления для Zerf Note с поддержкой CSS анимаций и переопределения интерфейса",
  author: "zerf-creator",
  githubUrl: "https://github.com/username/zerf-theme-community",
  type: "theme",
  category: "Темы & Стили",
  icon: "🌌",
  preview: {
    bg: "#09090b",
    surface: "#18181b",
    accent: "#10b981"
  },
  themeConfig: {
    theme: "strict",
    accentColor: "emerald",
    density: "compact",
    borderRadius: "rounded",
    customCss: "@keyframes glow { 0%, 100% { box-shadow: 0 0 10px rgba(16, 185, 129, 0.3); } 50% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.6); } }",
    i18nOverrides: {
      ru: { brandTag: "Zerf // Custom Style" }
    }
  }
}, null, 2)}
                    </pre>
                    <button
                      type="button"
                      onClick={() => {
                        const jsonStr = JSON.stringify({
                          name: "zerf-theme-community",
                          title: "My Custom Zerf Theme",
                          version: "1.0.0",
                          description: "Пользовательская тема оформления для Zerf Note",
                          author: "zerf-creator",
                          githubUrl: "https://github.com/username/zerf-theme-community",
                          type: "theme",
                          category: "Темы & Стили",
                          icon: "🌌",
                          preview: { bg: "#09090b", surface: "#18181b", accent: "#10b981" },
                          themeConfig: {
                            theme: "strict",
                            accentColor: "emerald",
                            density: "compact",
                            borderRadius: "rounded",
                            customCss: "@keyframes glow { 0%, 100% { box-shadow: 0 0 10px rgba(16, 185, 129, 0.3); } 50% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.6); } }",
                          }
                        }, null, 2)
                        navigator.clipboard.writeText(jsonStr)
                        setCopiedFile('json')
                        setTimeout(() => setCopiedFile(null), 2000)
                      }}
                      className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-card/90 hover:bg-card border border-border text-[10px] font-bold text-foreground flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      {copiedFile === 'json' ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedFile === 'json' ? 'Скопировано!' : 'Копировать JSON'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
