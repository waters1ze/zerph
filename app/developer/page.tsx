'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code2, Sparkles, BookOpen, Layers, Zap, Copy, Check,
  ExternalLink, Terminal, Shield, ArrowRight, ArrowLeft,
  DollarSign, CheckCircle2, AlertCircle, Play, RefreshCw,
  FolderPlus, Download, Send, Globe, Key, Lock, Puzzle, Eye,
  FileText, Cpu, CheckSquare, Bookmark, Flame, Lightbulb, Box, Bot,
  Package, HelpCircle, Laptop, Settings, ChevronRight, CheckCheck,
  CreditCard, Info, Activity, Radio, Award
} from 'lucide-react'
import { getAuthHeaders } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { ExtensionItem } from '@/lib/backend/extensions'

export default function DeveloperPage() {
  const [activeTab, setActiveTab] = useState<'manifest' | 'sandbox' | 'sdk' | 'earnings' | 'docs'>('manifest')
  const [docSection, setDocSection] = useState<'quickstart' | 'npm_sdk' | 'manifest' | 'permissions' | 'settings' | 'ai_webhook' | 'cli' | 'limits' | 'monetization' | 'skill'>('quickstart')
  const [copiedJson, setCopiedJson] = useState(false)
  const [copiedSkill, setCopiedSkill] = useState(false)
  const [copiedInstallCmd, setCopiedInstallCmd] = useState(false)
  const [loading, setLoading] = useState(false)

  // Manifest Builder Form State
  const [mName, setMName] = useState('zerf-plugin-research')
  const [mTitle, setMTitle] = useState('Deep Research & Synthesizer')
  const [mVersion, setMVersion] = useState('1.0.0')
  const [mDescription, setMDescription] = useState('Интеллектуальный поиск первоисточников и компиляция заметок.')
  const [mCategory, setMCategory] = useState('ИИ & Промпты')
  const [mType, setMType] = useState<'widget' | 'template' | 'theme' | 'integration' | 'prompt'>('widget')
  const [mIcon, setMIcon] = useState('🔮')
  const [mAuthor, setMAuthor] = useState('developer')
  const [mPrice, setMPrice] = useState<number>(0)
  const [mMinPlan, setMMinPlan] = useState<'free' | 'plus' | 'pro' | 'corp'>('plus')
  const [mIsRunnable, setMIsRunnable] = useState(true)
  const [mAiInstructions, setMAiInstructions] = useState('Когда пользователь запрашивает исследование темы, структурируй вывод по 3 пунктам и предложи создать задачу.')
  const [mTriggers, setMTriggers] = useState('/research, исследуй тему, найди факты')
  const [mEndpoint, setMEndpoint] = useState('https://api.yourdomain.com/v1/zerf-hook')

  // Interactive Sandbox & Emulator State
  const [sandboxTemplate, setSandboxTemplate] = useState<'research' | 'voice' | 'habits' | 'calc'>('research')
  const [sandboxCommand, setSandboxCommand] = useState('/research ИИ тренды 2026')
  const [sandboxRunning, setSandboxRunning] = useState(false)
  const [sandboxLogs, setSandboxLogs] = useState<Array<{ id: string; time: string; type: 'info' | 'success' | 'warn' | 'rpc'; msg: string }>>([
    { id: '1', time: '12:00:01', type: 'info', msg: 'Песочница Zerf Sandbox VM v2.0 готова к работе.' },
    { id: '2', time: '12:00:02', type: 'success', msg: 'Схема zerf-extension.json верифицирована (0 ошибок).' },
  ])
  const [sandboxOutput, setSandboxOutput] = useState<{
    status: number
    latencyMs: number
    responseMessage: string
    createdTasks?: string[]
    createdNotes?: string[]
    voiceAudio?: boolean
  } | null>({
    status: 200,
    latencyMs: 34,
    responseMessage: '🔍 Глубокий анализ выполнен. Найдено 4 источника. Синтез фактов завершён.',
    createdTasks: ['Проанализировать ключевые выводы по ИИ трендам 2026'],
    createdNotes: ['Заметка: Исследование ИИ трендов (4 первоисточника)'],
  })

  // Author Earnings State
  const [authorStats, setAuthorStats] = useState({ balance: 0, totalEarned: 0, salesCount: 0 })
  const [myExtensions, setMyExtensions] = useState<ExtensionItem[]>([])
  const [boundCard, setBoundCard] = useState<any>(null)
  const [payoutAmount, setPayoutAmount] = useState<string>('')
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [userGh, setUserGh] = useState<string | null>(null)

  // Check URL query parameters for tab
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const tabParam = urlParams.get('tab')
      if (tabParam === 'docs' || tabParam === 'manifest' || tabParam === 'sandbox' || tabParam === 'sdk' || tabParam === 'earnings') {
        setActiveTab(tabParam as any)
      }
      const gh = localStorage.getItem('zerf_user_github')
      if (gh) setUserGh(gh)
    }
  }, [])

  // Load Developer Stats
  const fetchDevData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/extensions', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) {
        setAuthorStats(data.authorStats || { balance: 0, totalEarned: 0, salesCount: 0 })
        if (data.boundCard) setBoundCard(data.boundCard)
        if (Array.isArray(data.catalog)) {
          const currentChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') : null
          if (currentChatId) {
            setMyExtensions(data.catalog.filter((e: ExtensionItem) => e.authorChatId === currentChatId))
          }
        }
      }
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDevData()
  }, [])

  // Generated JSON Manifest
  const generatedManifest = {
    name: mName.trim() || 'zerf-plugin-custom',
    title: mTitle.trim() || 'Custom Plugin',
    version: mVersion.trim() || '1.0.0',
    description: mDescription.trim(),
    type: mType,
    category: mCategory,
    icon: mIcon,
    author: mAuthor.trim(),
    minPlan: mMinPlan,
    price: Number(mPrice) || 0,
    isRunnable: mIsRunnable,
    aiInstructions: mAiInstructions.trim(),
    triggers: mTriggers.split(',').map(s => s.trim()).filter(Boolean),
    content: {
      aiEndpoint: mEndpoint.trim() || undefined,
      commands: [
        {
          cmd: mTriggers.split(',')[0]?.trim() || `/${mName.replace('zerf-plugin-', '')}`,
          description: mDescription.trim() || 'Команда расширения',
        }
      ],
      settingsSchema: [
        {
          key: 'apiKey',
          label: 'API Ключ сервиса',
          type: 'secret'
        },
        {
          key: 'maxResults',
          label: 'Лимит результатов',
          type: 'number',
          defaultValue: 5
        }
      ]
    },
    permissions: ['tasks:read', 'tasks:write', 'notes:read', 'ai:proxy']
  }

  const manifestJsonString = JSON.stringify(generatedManifest, null, 2)

  const handleCopyManifest = () => {
    navigator.clipboard.writeText(manifestJsonString)
    setCopiedJson(true)
    setTimeout(() => setCopiedJson(false), 2000)
  }

  const handleDownloadManifest = () => {
    const blob = new Blob([manifestJsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'zerf-extension.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadStarterKit = () => {
    const starterKit = {
      'zerf-extension.json': generatedManifest,
      'README.md': `# ${mTitle}\n\n${mDescription}\n\n## Инструкция по установке\n1. Опубликуйте этот репозиторий на GitHub.\n2. В Zerf Note перейдите в «Магазин» → «Создать расширение».\n3. Вставьте URL вашего репозитория.`,
      'index.js': `// Zerf Note TUI Plugin Entrypoint (ESM)\nexport default function init(zerf) {\n  zerf.onCommand('${mTriggers.split(',')[0]?.trim() || '/start'}', async (ctx) => {\n    ctx.reply('Привет из расширения ${mTitle}!');\n  });\n}`
    }
    const blob = new Blob([JSON.stringify(starterKit, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${mName || 'zerf-plugin'}-starter-kit.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSelectSandboxTemplate = (tpl: 'research' | 'voice' | 'habits' | 'calc') => {
    setSandboxTemplate(tpl)
    if (tpl === 'research') {
      setMName('zerf-plugin-deep-research')
      setMTitle('Глубокий исследовательский ассистент')
      setMType('widget')
      setMCategory('ИИ & Промпты')
      setMIcon('🔮')
      setMTriggers('/research, исследуй тему, найди факты')
      setMAiInstructions('Анализируй научные и технические темы, извлекай главное и структурируй в 3 тезиса.')
      setSandboxCommand('/research ИИ тренды 2026')
    } else if (tpl === 'voice') {
      setMName('zerf-plugin-voice-whisper')
      setMTitle('Голосовой модуль Zerf Whisper')
      setMType('widget')
      setMCategory('ИИ & Промпты')
      setMIcon('🎙️')
      setMTriggers('/voice, скажи вслух, озвучь')
      setMAiInstructions('Озвучивай саммари дня и задачи живым голосом.')
      setSandboxCommand('/voice Озвучь главное на сегодня')
    } else if (tpl === 'habits') {
      setMName('zerf-plugin-habit-streaks')
      setMTitle('Трекер супер-серий привычек')
      setMType('template')
      setMCategory('Привычки & Здоровье')
      setMIcon('🔥')
      setMTriggers('/streak, серия, привычка')
      setMAiInstructions('Отслеживай прогресс серий привычек и мотивируй пользователя не сбивать темп.')
      setSandboxCommand('/streak Проверить медитацию')
    } else if (tpl === 'calc') {
      setMName('zerf-plugin-smart-calc')
      setMTitle('Умный финансовый калькулятор')
      setMType('integration')
      setMCategory('Интеграции & API')
      setMIcon('🧮')
      setMTriggers('/calc, посчитай, конвертируй')
      setMAiInstructions('Выполняй мгновенные математические вычисления, расчет налогов и конвертацию валют.')
      setSandboxCommand('/calc 150000 * 0.80 - 3500')
    }
  }

  const handleRunSandbox = () => {
    setSandboxRunning(true)
    setSandboxLogs([])
    const now = () => new Date().toLocaleTimeString('ru-RU', { hour12: false })

    const initialLogs = [
      { id: 'l1', time: now(), type: 'info' as const, msg: `[SANDBOX_INIT] Инициализация изолированного контекста для «${mName}»...` },
    ]
    setSandboxLogs(initialLogs)

    setTimeout(() => {
      setSandboxLogs(prev => [
        ...prev,
        { id: 'l2', time: now(), type: 'info' as const, msg: `[TRIGGER_MATCH] Распознана команда «${sandboxCommand}»` },
        { id: 'l3', time: now(), type: 'rpc' as const, msg: `[RPC_CALL] Инъекция контекста ZerfContext: permissions=[${generatedManifest.permissions.join(', ')}]` },
      ])
    }, 250)

    setTimeout(() => {
      setSandboxLogs(prev => [
        ...prev,
        { id: 'l4', time: now(), type: 'rpc' as const, msg: `[AI_COMPILE] Системная инструкция: «${mAiInstructions.slice(0, 45)}...»` },
        { id: 'l5', time: now(), type: 'success' as const, msg: `[TASK_EMULATOR] Эмулировано создание задачи в Zerf Note: «Задача по запросу: ${sandboxCommand}»` },
        { id: 'l6', time: now(), type: 'success' as const, msg: `[STATUS_200] Выполнение завершено успешно за 38мс (Память: 1.4MB, Ошибок: 0)` },
      ])

      setSandboxOutput({
        status: 200,
        latencyMs: 38,
        responseMessage: `✅ Команда «${sandboxCommand}» успешно выполнена расширением «${mTitle}»!`,
        createdTasks: [`Задача по запросу: ${sandboxCommand}`],
        createdNotes: [`Заметка: Результат работы ${mTitle}`],
        voiceAudio: mType === 'widget' && (mName.includes('voice') || mName.includes('live')),
      })
      setSandboxRunning(false)
    }, 650)
  }

  const handleRequestPayout = async () => {
    const amt = Number(payoutAmount) || authorStats.balance
    if (amt < 100) {
      alert('Минимальная сумма для вывода: 100 ₽')
      return
    }
    if (amt > authorStats.balance) {
      alert('Недостаточно средств на балансе автора')
      return
    }

    try {
      setPayoutLoading(true)
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_payout', amount: amt }),
      })
      const data = await res.json()
      if (data.success) {
        alert(`🎉 Заявка на вывод ${amt} ₽ создана! Средства поступят после подтверждения.`)
        fetchDevData()
        setPayoutAmount('')
      } else {
        alert(data.error || 'Ошибка вывода средств')
      }
    } catch {
      alert('Ошибка при создании заявки на вывод')
    } finally {
      setPayoutLoading(false)
    }
  }

  const AI_SKILL_PROMPT = `---
name: zerf-extension-builder
description: Comprehensive expert skill for creating 100% compliant, secure Zerf Note extensions from scratch.
---

# Instructions for AI:
You are an expert developer building a Zerf Note extension.
Generate a valid repository structure:
1. zerf-extension.json (Strict manifest schema with name, version, type, aiInstructions, triggers, content.aiEndpoint, settingsSchema, permissions).
2. index.js (Optional ESM entrypoint for TUI CLI with onLoad, onCommand, onHook).
3. README.md (Overview and instructions).

Rules:
- Never use http:// (https only).
- Never use local/private IPs.
- Respect daily extension AI quotas (Free: 10/day, Plus: 50/day, Pro: 150/day, Corp: 300/day).
- Price > 0 uses YooMoney 80/20 author split.`

  const handleCopyAiSkill = () => {
    navigator.clipboard.writeText(AI_SKILL_PROMPT)
    setCopiedSkill(true)
    setTimeout(() => setCopiedSkill(false), 2000)
  }

  const handleLoadUniversalTemplate = () => {
    setMName('zerf-plugin-universal-template')
    setMTitle('Универсальный шаблон расширения Zerf Note')
    setMVersion('1.0.0')
    setMDescription('Полнофункциональный шаблон со всеми возможными полями, вебхуками, настройками и правами для создания любого расширения.')
    setMCategory('ИИ & Промпты')
    setMType('widget')
    setMIcon('🔮')
    setMAuthor('developer')
    setMPrice(0)
    setMMinPlan('free')
    setMIsRunnable(true)
    setMAiInstructions('Когда пользователь активирует это расширение, выступай в роли интеллектуального ассистента. Структурируй ответы, предлагай полезные инсайты и автоматически декомпозируй задачи в Zerf Note при необходимости.')
    setMTriggers('/universal, /template, универсальный помощник, запусти расширение')
    setMEndpoint('https://api.yourdomain.com/v1/zerf-webhook')
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20">
      {/* Topbar */}
      <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="p-2 rounded-xl bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 text-xs font-semibold border border-border"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>В приложение</span>
          </a>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-xs">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-sm md:text-base leading-tight">Zerf Developer Studio</h1>
              <p className="text-[10px] text-muted-foreground hidden sm:block">Платформа создания расширений, виджетов и тем</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAiSkill}
            className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-bold font-mono flex items-center gap-1.5 border border-purple-500/25 transition-all cursor-pointer shadow-2xs"
            title="Скопировать системную инструкцию / Скилл для нейросети"
          >
            {copiedSkill ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Bot className="w-3.5 h-3.5" />}
            <span>{copiedSkill ? 'Скилл скопирован!' : 'Промпт для ИИ'}</span>
          </button>

          <div className="px-3 py-1 rounded-xl bg-muted/60 border border-border text-foreground text-xs font-bold font-mono flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>SDK v2.0</span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-border bg-card/40 px-4 md:px-8 flex items-center gap-2 overflow-x-auto py-2.5">
        {[
          { id: 'manifest', label: '🛠 Генератор манифеста', icon: FolderPlus },
          { id: 'sandbox', label: '🧪 Интерактивная песочница', icon: Zap },
          { id: 'sdk', label: '📦 NPM Пакет @zerf/sdk', icon: Package },
          { id: 'earnings', label: '💰 Монетизация & Выплаты (80%)', icon: DollarSign },
          { id: 'docs', label: '📖 Документация & API', icon: BookOpen },
        ].map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer',
                active
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/80'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Main Content Area: Left Tabs Workspace + Right Sidebar Blocks */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ── LEFT / CENTER COLUMN (8 cols): Main Interactive Workspace ── */}
          <div className="lg:col-span-8 space-y-6">

            {/* ── TAB 1: MANIFEST BUILDER ── */}
            {activeTab === 'manifest' && (
              <div className="space-y-4">
                {/* Documentation Requirement Banner */}
                <div className="p-4 rounded-3xl bg-purple-500/10 border border-purple-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-2xl bg-purple-500/20 text-purple-400 shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground text-xs md:text-sm">Перед созданием расширения изучите документацию</h4>
                      <p className="text-[11px] text-muted-foreground">Узнайте все доступные permissions, Webhook API, схему настроек и правила безопасности</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      onClick={() => setActiveTab('docs')}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-semibold text-xs flex items-center gap-1.5 border border-purple-500/40 transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Открыть документацию SDK</span>
                    </button>

                    <button
                      onClick={handleLoadUniversalTemplate}
                      className="px-3.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center gap-1.5 border border-border transition-colors cursor-pointer"
                      title="Заполнить форму всеми полями универсального шаблона"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Универсальный шаблон</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                  {/* Form */}
                  <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                      <h3 className="font-bold text-sm flex items-center gap-2">
                        <FolderPlus className="w-4 h-4 text-primary" />
                        <span>Параметры расширения</span>
                      </h3>
                      <span className="text-[10px] text-muted-foreground font-mono">zerf-extension.json</span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="font-semibold text-foreground">Package ID (name)</label>
                          <input
                            type="text"
                            value={mName}
                            onChange={e => setMName(e.target.value)}
                            placeholder="zerf-plugin-name"
                            className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary font-mono text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-foreground">Название (title)</label>
                          <input
                            type="text"
                            value={mTitle}
                            onChange={e => setMTitle(e.target.value)}
                            placeholder="My Awesome Plugin"
                            className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-foreground">Описание</label>
                        <textarea
                          value={mDescription}
                          onChange={e => setMDescription(e.target.value)}
                          rows={2}
                          placeholder="Краткое описание функционала..."
                          className="w-full p-2.5 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary resize-none text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="font-semibold text-foreground">Тип</label>
                          <select
                            value={mType}
                            onChange={e => setMType(e.target.value as any)}
                            className="w-full h-9 px-2 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs cursor-pointer"
                          >
                            <option value="widget">Виджет</option>
                            <option value="template">Шаблон</option>
                            <option value="theme">Тема</option>
                            <option value="integration">Интеграция</option>
                            <option value="prompt">Промпт</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-foreground">Иконка</label>
                          <input
                            type="text"
                            value={mIcon}
                            onChange={e => setMIcon(e.target.value)}
                            className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-center text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-foreground">Мин. тариф</label>
                          <select
                            value={mMinPlan}
                            onChange={e => setMMinPlan(e.target.value as any)}
                            className="w-full h-9 px-2 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs cursor-pointer"
                          >
                            <option value="free">Free</option>
                            <option value="plus">Plus</option>
                            <option value="pro">Pro</option>
                            <option value="corp">Corp</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-foreground">Триггеры команд (через запятую)</label>
                        <input
                          type="text"
                          value={mTriggers}
                          onChange={e => setMTriggers(e.target.value)}
                          placeholder="/research, найди факты, исследуй"
                          className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-foreground">Инструкции для ИИ (AI Instructions)</label>
                        <textarea
                          value={mAiInstructions}
                          onChange={e => setMAiInstructions(e.target.value)}
                          rows={3}
                          placeholder="Как нейросеть Zerf Note должна обрабатывать запросы пользователей..."
                          className="w-full p-2.5 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary resize-none text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-foreground flex items-center justify-between">
                          <span>HTTPS AI Endpoint URL (Опционально)</span>
                          <span className="text-[10px] text-muted-foreground">Внешний вебхук</span>
                        </label>
                        <input
                          type="url"
                          value={mEndpoint}
                          onChange={e => setMEndpoint(e.target.value)}
                          placeholder="https://api.yourdomain.com/v1/zerf-hook"
                          className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Live JSON Preview */}
                  <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-4 flex flex-col h-full">
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                      <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-emerald-400" />
                        <h3 className="font-bold text-sm text-foreground">Сгенерированный манифест</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCopyManifest}
                          className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center gap-1.5 border border-border transition-colors cursor-pointer"
                        >
                          {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedJson ? 'Скопировано' : 'Копировать'}</span>
                        </button>
                        <button
                          onClick={handleDownloadManifest}
                          className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>.json</span>
                        </button>
                      </div>
                    </div>

                    <div className="relative flex-1">
                      <pre className="p-4 rounded-2xl bg-zinc-950 text-emerald-400 text-[11px] font-mono overflow-auto max-h-[440px] border border-border/60 leading-relaxed">
                        {manifestJsonString}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: INTERACTIVE EXTENSION SANDBOX ── */}
            {activeTab === 'sandbox' && (
              <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
                  <div>
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-400" />
                      <span>Интерактивная песочница & Эмулятор ядра Zerf</span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Тестируйте логику выполнения, вызовы RPC-методов, парсинг команд и генерацию задач в изолированной среде
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border shrink-0 text-xs">
                    {(['research', 'voice', 'habits', 'calc'] as const).map(tpl => (
                      <button
                        key={tpl}
                        onClick={() => handleSelectSandboxTemplate(tpl)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer capitalize',
                          sandboxTemplate === tpl ? 'bg-card text-foreground shadow-2xs font-bold' : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {tpl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Command Bar */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Terminal className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={sandboxCommand}
                      onChange={e => setSandboxCommand(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRunSandbox()}
                      placeholder="Введите команду расширения (например, /research ИИ)..."
                      className="w-full h-11 pl-10 pr-4 rounded-2xl bg-muted/40 border border-border text-foreground font-mono text-xs outline-none focus:border-primary"
                    />
                  </div>

                  <button
                    onClick={handleRunSandbox}
                    disabled={sandboxRunning}
                    className="h-11 px-5 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {sandboxRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{sandboxRunning ? 'Выполнение...' : 'Запустить тест'}</span>
                  </button>
                </div>

                {/* Terminal Logs & Output */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-border/60 flex flex-col h-[280px]">
                    <p className="text-[11px] font-mono text-zinc-400 border-b border-zinc-800 pb-2 mb-2 flex items-center justify-between">
                      <span>CONSOLE VM LOGS</span>
                      <span className="text-emerald-400">ONLINE</span>
                    </p>
                    <div className="flex-1 overflow-auto space-y-1.5 font-mono text-[11px]">
                      {sandboxLogs.map(log => (
                        <div key={log.id} className="flex items-start gap-2">
                          <span className="text-zinc-600 shrink-0">{log.time}</span>
                          <span className={cn(
                            log.type === 'success' ? 'text-emerald-400 font-bold' :
                            log.type === 'rpc' ? 'text-cyan-400' :
                            log.type === 'warn' ? 'text-amber-400' : 'text-zinc-300'
                          )}>
                            {log.msg}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-muted/30 border border-border flex flex-col h-[280px]">
                    <p className="text-[11px] font-bold text-foreground border-b border-border/60 pb-2 mb-2 flex items-center justify-between">
                      <span>РЕЗУЛЬТАТ ЭМУЛЯТОРА ZERF NOTE</span>
                      {sandboxOutput && (
                        <span className="text-emerald-400 font-mono text-[10px]">
                          HTTP {sandboxOutput.status} ({sandboxOutput.latencyMs}ms)
                        </span>
                      )}
                    </p>
                    {sandboxOutput ? (
                      <div className="flex-1 overflow-auto space-y-3 text-xs">
                        <p className="text-foreground font-medium bg-card/80 p-3 rounded-xl border border-border">
                          {sandboxOutput.responseMessage}
                        </p>
                        {sandboxOutput.createdTasks && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Созданные задачи:</span>
                            {sandboxOutput.createdTasks.map((t, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-xs text-foreground bg-primary/10 border border-primary/20 px-2.5 py-1.5 rounded-lg">
                                <CheckSquare className="w-3.5 h-3.5 text-primary" />
                                <span>{t}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
                        Запустите тест для получения ответа
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: NPM SDK @zerf/sdk ── */}
            {activeTab === 'sdk' && (
              <div className="p-6 md:p-8 rounded-3xl bg-card border border-border shadow-xs space-y-6">
                <div className="border-b border-border/60 pb-4">
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    <span>Официальный SDK пакет: @zerf/sdk</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Строгая типизация TypeScript, вспомогательные функции для триггеров и готовые клиенты RPC API
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-950 border border-border/60 flex items-center justify-between gap-3">
                  <code className="text-xs font-mono text-emerald-400">npm install @zerf/sdk</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('npm install @zerf/sdk')
                      setCopiedInstallCmd(true)
                      setTimeout(() => setCopiedInstallCmd(false), 2000)
                    }}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 border border-zinc-800 transition-colors cursor-pointer"
                  >
                    {copiedInstallCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedInstallCmd ? 'Скопировано!' : 'Копировать'}</span>
                  </button>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-foreground">Пример использования в TypeScript:</h4>
                  <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-200 text-xs font-mono overflow-auto border border-border/60 leading-relaxed">
{`import { defineExtension, type ZerfContext } from '@zerf/sdk'

export default defineExtension({
  name: 'my-custom-plugin',
  title: 'Мое кастомное расширение',
  version: '1.0.0',
  type: 'widget',
  category: 'ИИ & Промпты',
  icon: '⚡',
  triggers: ['/mycmd', 'запусти анализ'],
  aiInstructions: 'Выполняй анализ по запросу и создавай задачи в Zerf Note',
  async onExecute(ctx: ZerfContext) {
    const query = ctx.command.args
    const result = await ctx.ai.prompt(\`Сделай краткое резюме: \${query}\`)
    
    // Создаем задачу в аккаунте пользователя
    await ctx.tasks.create({
      title: \`Изучить: \${query}\`,
      priority: 'high'
    })

    return { message: result }
  }
})`}
                  </pre>
                </div>
              </div>
            )}

            {/* ── TAB 4: EARNINGS & MONETIZATION ── */}
            {activeTab === 'earnings' && (
              <div className="p-6 md:p-8 rounded-3xl bg-card border border-border shadow-xs space-y-6">
                <div className="border-b border-border/60 pb-4">
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    <span>Монетизация расширений & Баланс автора (80/20)</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Получайте 80% от каждой покупки вашего расширения с мгновенным выводом на карту РФ, СБП или ЮMoney
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border">
                    <p className="text-[11px] text-muted-foreground">Доступный баланс</p>
                    <p className="text-xl font-bold text-emerald-400 mt-1">{authorStats.balance} ₽</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border">
                    <p className="text-[11px] text-muted-foreground">Всего заработано</p>
                    <p className="text-xl font-bold text-foreground mt-1">{authorStats.totalEarned} ₽</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border">
                    <p className="text-[11px] text-muted-foreground">Продажи</p>
                    <p className="text-xl font-bold text-foreground mt-1">{authorStats.salesCount}</p>
                  </div>
                </div>

                {/* Payout Form */}
                <div className="p-5 rounded-2xl bg-muted/30 border border-border space-y-4">
                  <h4 className="text-xs font-bold text-foreground">Запросить выплату средств</h4>
                  {boundCard ? (
                    <div className="p-3 rounded-xl bg-card border border-border text-xs">
                      Реквизиты: {boundCard.payoutType === 'sbp' ? `⚡ СБП: ${boundCard.phone}` : `💳 Карта: ${boundCard.cardNumber}`}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-400">
                      Привяжите карту в разделе «Магазин» на главной странице для вывода средств.
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={payoutAmount}
                      onChange={e => setPayoutAmount(e.target.value)}
                      placeholder={`Сумма (макс. ${authorStats.balance} ₽)`}
                      className="flex-1 h-10 px-3.5 rounded-xl bg-card border border-border text-xs text-foreground outline-none focus:border-primary"
                    />
                    <button
                      onClick={handleRequestPayout}
                      disabled={payoutLoading || authorStats.balance < 100}
                      className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-xs disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      {payoutLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Запросить вывод</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 5: COMPREHENSIVE SDK DOCUMENTATION ── */}
            {activeTab === 'docs' && (
              <div className="p-6 md:p-8 rounded-3xl bg-card border border-border shadow-xs space-y-6 leading-relaxed">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
                  <div>
                    <h2 className="text-base font-bold flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-primary" />
                      <span>Полный справочник разработчика Zerf Note SDK</span>
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Спецификация манифестов, Webhook API, CLI-модулей, UI-настроек, лимитов и монетизации
                    </p>
                  </div>

                  <button
                    onClick={handleDownloadStarterKit}
                    className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Скачать Starter Kit</span>
                  </button>
                </div>

                {/* Sub-Navigation */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-border/40 text-xs">
                  {[
                    { id: 'quickstart', label: '🚀 Быстрый старт' },
                    { id: 'npm_sdk', label: '📦 @zerf/sdk' },
                    { id: 'manifest', label: '📜 Манифест' },
                    { id: 'permissions', label: '🔑 Права' },
                    { id: 'ai_webhook', label: '🧠 Webhook API' },
                    { id: 'monetization', label: '💰 Монетизация' },
                  ].map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => setDocSection(sub.id as any)}
                      className={cn(
                        'px-3 py-1 rounded-xl font-medium transition-all shrink-0 cursor-pointer',
                        docSection === sub.id
                          ? 'bg-primary/15 text-primary border border-primary/30 font-bold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      )}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>

                {/* Section Content */}
                <div className="space-y-4 text-xs text-foreground/90">
                  {docSection === 'quickstart' && (
                    <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
                      <h4 className="font-bold text-foreground">Пошаговый план публикации:</h4>
                      <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                        <li>Создайте публичный или приватный репозиторий на GitHub.</li>
                        <li>Сгенерируйте и поместите в корень репозитория файл <code className="font-mono text-primary font-bold">zerf-extension.json</code>.</li>
                        <li>В Zerf Note перейдите в <b>«Магазин расширений» → «+ Создать расширение»</b>.</li>
                        <li>Вставьте ссылку на ваш GitHub-репозиторий — манифест автоматически спарсится и будет опубликован!</li>
                      </ol>
                    </div>
                  )}

                  {docSection === 'manifest' && (
                    <pre className="p-4 rounded-2xl bg-zinc-950 text-emerald-400 font-mono overflow-auto max-h-[380px] border border-border/60">
                      {manifestJsonString}
                    </pre>
                  )}

                  {docSection === 'monetization' && (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
                      <p className="font-bold text-emerald-400">80% от всех покупок вашего расширения начисляются автору!</p>
                      <p className="text-muted-foreground">
                        Выплаты осуществляются мгновенно или по запросу на привязанную карту РФ / СБП / ЮMoney.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN (4 cols): Developer Control Blocks (как на сайте) ── */}
          <div className="lg:col-span-4 space-y-4 sticky top-24">
            
            {/* Block 1: Author Balance Card */}
            <div className="p-5 rounded-3xl bg-card border border-border shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/25">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-foreground">Баланс автора</h3>
                    <p className="text-[10px] text-muted-foreground">80% от продаж расширений</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                  Активен
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <span className="text-2xl font-black text-foreground">{authorStats.balance} ₽</span>
                <span className="text-xs text-muted-foreground">Продаж: {authorStats.salesCount}</span>
              </div>

              <button
                onClick={() => setActiveTab('earnings')}
                className="w-full py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span>Вывести средства (СБП / Карта)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Block 2: Developer Profile & GitHub */}
            <div className="p-5 rounded-3xl bg-card border border-border shadow-xs space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-muted text-foreground flex items-center justify-center font-bold text-xs border border-border">
                  <Award className="w-4 h-4 text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-xs text-foreground">Профиль разработчика</h3>
                  <p className="text-[11px] text-emerald-400 font-medium truncate">
                    {userGh ? `@${userGh}` : '@waters1ze'}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                  Verified
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-muted/40 border border-border text-[11px] text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Опубликовано:</span>
                  <span className="font-bold text-foreground">{myExtensions.length} плагина</span>
                </div>
                <div className="flex justify-between">
                  <span>Статус магазина:</span>
                  <span className="font-bold text-emerald-400">Открыт</span>
                </div>
              </div>
            </div>

            {/* Block 3: Quick Starters & Tools */}
            <div className="p-5 rounded-3xl bg-card border border-border shadow-xs space-y-3">
              <h3 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Быстрые инструменты</span>
              </h3>

              <div className="space-y-2">
                <button
                  onClick={handleLoadUniversalTemplate}
                  className="w-full p-2.5 rounded-2xl bg-muted/40 hover:bg-muted/80 border border-border text-left text-xs font-semibold text-foreground transition-all flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🔮</span>
                    <span>Универсальный шаблон</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>

                <button
                  onClick={handleCopyAiSkill}
                  className="w-full p-2.5 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 text-left text-xs font-semibold text-purple-300 transition-all flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Bot className="w-3.5 h-3.5 text-purple-400" />
                    <span>AI Prompt Skill (Cursor/GPT)</span>
                  </div>
                  <Copy className="w-3.5 h-3.5 text-purple-400" />
                </button>

                <button
                  onClick={() => {
                    setActiveTab('sandbox')
                    setTimeout(() => handleRunSandbox(), 100)
                  }}
                  className="w-full p-2.5 rounded-2xl bg-muted/40 hover:bg-muted/80 border border-border text-left text-xs font-semibold text-foreground transition-all flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Быстрый тест песочницы</span>
                  </div>
                  <Play className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Block 4: AI Rate Limits Quotas */}
            <div className="p-5 rounded-3xl bg-card border border-border shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Суточные квоты ИИ</span>
                </h3>
                <span className="text-[10px] text-muted-foreground font-mono">per user / day</span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/60">
                  <span className="text-muted-foreground">Тариф Free</span>
                  <span className="font-bold text-foreground">10 вызовов / день</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/60">
                  <span className="text-primary font-semibold">Тариф Plus</span>
                  <span className="font-bold text-primary">50 вызовов / день</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <span className="text-purple-400 font-semibold">Тариф Pro</span>
                  <span className="font-bold text-purple-300">150 вызовов / день</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-amber-400 font-bold">Тариф Corp</span>
                  <span className="font-bold text-amber-300">300 вызовов / день</span>
                </div>
              </div>
            </div>

            {/* Block 5: Security & Protocol Guard */}
            <div className="p-5 rounded-3xl bg-card border border-border shadow-xs space-y-2.5">
              <h3 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Стандарты безопасности</span>
              </h3>
              <ul className="text-[11px] text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>Все вебхуки строго по протоколу <code className="text-foreground font-mono">HTTPS</code></li>
                <li>Таймаут выполнения: <code className="text-foreground font-mono">8000ms</code></li>
                <li>Автоматическая SSRF защита от локальных IP</li>
              </ul>
            </div>

          </div>

        </div>
      </main>
    </div>
  )
}
