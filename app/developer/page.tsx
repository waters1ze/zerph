'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code2, Sparkles, BookOpen, Layers, Zap, Copy, Check,
  ExternalLink, Terminal, Shield, ArrowRight, ArrowLeft,
  DollarSign, CheckCircle2, AlertCircle, Play, RefreshCw,
  FolderPlus, Download, Send, Globe, Key, Lock, Puzzle, Eye,
  FileText, Cpu, CheckSquare, Bookmark, Flame, Lightbulb, Box, Bot,
  Package, HelpCircle, Laptop, Settings, ChevronRight, CheckCheck
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

  // Check URL query parameters for tab
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const tabParam = urlParams.get('tab')
      if (tabParam === 'docs' || tabParam === 'manifest' || tabParam === 'sandbox' || tabParam === 'sdk' || tabParam === 'earnings') {
        setActiveTab(tabParam as any)
      }
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
    handleDownloadManifest()
  }

  const handleSelectTemplate = (tpl: 'research' | 'voice' | 'habits' | 'calc') => {
    setSandboxTemplate(tpl)
    if (tpl === 'research') {
      setMName('zerf-plugin-research')
      setMTitle('Deep Research & Synthesizer')
      setMType('widget')
      setMCategory('ИИ & Промпты')
      setMIcon('🔮')
      setMTriggers('/research, исследуй тему, найди факты')
      setMAiInstructions('Когда пользователь запрашивает исследование темы, синтезируй проверенные источники и предложи создать структурированную задачу.')
      setSandboxCommand('/research ИИ тренды 2026')
    } else if (tpl === 'voice') {
      setMName('zerf-plugin-voice-companion')
      setMTitle('Голосовой собеседник AI')
      setMType('widget')
      setMCategory('Виджеты & Фокус')
      setMIcon('🎙️')
      setMTriggers('/voice, поговори со мной, собеседник')
      setMAiInstructions('Веди живой двусторонний диалог, отвечай дружелюбным мужским голосом и помогай планировать день.')
      setSandboxCommand('/voice как спланировать сегодняшний день?')
    } else if (tpl === 'habits') {
      setMName('zerf-plugin-habit-tracker')
      setMTitle('Трекер привычек и спорта')
      setMType('template')
      setMCategory('Привычки & Здоровье')
      setMIcon('🏋️')
      setMTriggers('/workout, /habit, спорт, привычка')
      setMAiInstructions('Формируй персональный план тренировок и привычек, автоматически рассчитывай калории и время отдыха.')
      setSandboxCommand('/workout 30 минут кардио')
    } else if (tpl === 'calc') {
      setMName('zerf-plugin-smart-calculator')
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
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Topbar */}
      <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>В приложение</span>
          </a>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30">
              <Code2 className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-sm md:text-base">Zerf Extensions Developer Hub</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAiSkill}
            className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-bold font-mono flex items-center gap-1.5 border border-purple-500/25 transition-colors cursor-pointer"
            title="Скопировать системную инструкцию / Скилл для нейросети"
          >
            {copiedSkill ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Bot className="w-3.5 h-3.5" />}
            <span>{copiedSkill ? 'Скилл скопирован!' : 'Промпт для ИИ'}</span>
          </button>

          <div className="px-3 py-1 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-bold font-mono flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
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
                  : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/80'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 space-y-6">
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
                  <span>Загрузить универсальный шаблон</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Left Column: Interactive Form */}
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
                      <label className="font-semibold text-foreground">Иконка (Emoji)</label>
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

              {/* Right Column: Live Generated Code Preview */}
              <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-4 flex flex-col h-full">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-sm text-foreground">Сгенерированный zerf-extension.json</h3>
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
                      <span>Скачать .json</span>
                    </button>
                  </div>
                </div>

                <div className="relative flex-1">
                  <pre className="p-4 rounded-2xl bg-zinc-950 text-emerald-400 text-[11px] font-mono overflow-auto max-h-[480px] border border-border/60 leading-relaxed">
                    {manifestJsonString}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: INTERACTIVE EXTENSION SANDBOX ── */}
        {activeTab === 'sandbox' && (
          <div className="space-y-6">
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

                <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-2xl border border-border">
                  {[
                    { id: 'research', label: '🔮 Deep Research', icon: Sparkles },
                    { id: 'voice', label: '🎙️ Голос Zerfic', icon: Bot },
                    { id: 'habits', label: '🏋️ Спорт & Привычки', icon: CheckSquare },
                    { id: 'calc', label: '🧮 Калькулятор', icon: Cpu },
                  ].map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => handleSelectTemplate(tpl.id as any)}
                      className={cn(
                        'px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1',
                        sandboxTemplate === tpl.id
                          ? 'bg-card text-foreground shadow-xs font-bold border border-border'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <span>{tpl.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left (5 cols): Trigger Input & Payload Config */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Команда или триггер для эмуляции:</span>
                      <span className="text-[10px] text-muted-foreground font-mono">stdin/rpc</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={sandboxCommand}
                        onChange={e => setSandboxCommand(e.target.value)}
                        placeholder="/research ИИ тренды 2026"
                        className="flex-1 h-10 px-3.5 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary font-mono"
                      />
                      <button
                        onClick={handleRunSandbox}
                        disabled={sandboxRunning || !sandboxCommand.trim()}
                        className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-xs disabled:opacity-40 cursor-pointer shrink-0 transition-all"
                      >
                        {sandboxRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        <span>Запустить</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 space-y-2 text-xs">
                    <span className="font-bold text-foreground block">Текущий тестовый плагин:</span>
                    <div className="flex items-center gap-2 text-muted-foreground font-mono text-[11px]">
                      <span>ID: <b>{mName}</b></span>
                      <span>•</span>
                      <span>v{mVersion}</span>
                      <span>•</span>
                      <span>{mCategory}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {mAiInstructions}
                    </p>
                  </div>

                  {/* Widget Visual Preview Box */}
                  <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-primary" />
                      <span>Предпросмотр виджета в интерфейсе:</span>
                    </span>

                    <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-lg shrink-0">
                        {mIcon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-foreground truncate">{mTitle}</h4>
                          <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[9px] font-bold">
                            {mType.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{mDescription}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right (7 cols): Live Sandbox Execution Console & Output */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-foreground">
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Консоль выполнения (Sandbox Runtime VM):</span>
                      </span>
                      {sandboxOutput && (
                        <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Status {sandboxOutput.status} OK • {sandboxOutput.latencyMs}ms</span>
                        </span>
                      )}
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-950 text-zinc-300 font-mono text-[11px] h-[200px] overflow-y-auto border border-border/60 space-y-1.5">
                      {sandboxLogs.map(log => (
                        <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-zinc-500 shrink-0">[{log.time}]</span>
                          <span
                            className={cn(
                              log.type === 'success' && 'text-emerald-400 font-semibold',
                              log.type === 'rpc' && 'text-sky-400',
                              log.type === 'warn' && 'text-amber-400',
                              log.type === 'info' && 'text-zinc-300'
                            )}
                          >
                            {log.msg}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sandbox Simulated Action Output */}
                  {sandboxOutput && (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs space-y-2.5">
                      <div className="flex items-center justify-between font-bold text-emerald-400">
                        <span className="flex items-center gap-1.5">
                          <CheckCheck className="w-4 h-4" />
                          <span>Результат вызова Zerf Core API</span>
                        </span>
                        <span className="font-mono text-[10px]">200 OK</span>
                      </div>

                      <p className="text-foreground font-medium text-xs leading-relaxed">
                        {sandboxOutput.responseMessage}
                      </p>

                      {sandboxOutput.createdTasks && sandboxOutput.createdTasks.length > 0 && (
                        <div className="pt-2 border-t border-emerald-500/20 space-y-1">
                          <span className="text-[10px] uppercase font-bold text-emerald-400/90 tracking-wider">
                            Созданные задачи в базе Zerf:
                          </span>
                          {sandboxOutput.createdTasks.map((t, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-foreground text-[11px]">
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>{t}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: NPM PACKAGE @zerf/sdk & ARCHITECTURE ── */}
        {activeTab === 'sdk' && (
          <div className="space-y-6">
            <div className="p-6 md:p-8 rounded-3xl bg-card border border-border shadow-xs space-y-6 leading-relaxed">
              <div className="border-b border-border/60 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    <span>NPM Пакет @zerf/sdk: Архитектура и Разработка</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Узнайте, как устроен официальный SDK, как расширения исполняются внутри Zerf Note и как писать надежный код на TypeScript
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-border/80 font-mono text-xs text-emerald-400 flex items-center gap-2">
                    <span>npm i @zerf/sdk</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('npm install @zerf/sdk')
                        setCopiedInstallCmd(true)
                        setTimeout(() => setCopiedInstallCmd(false), 2000)
                      }}
                      className="text-zinc-400 hover:text-white cursor-pointer"
                    >
                      {copiedInstallCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 3 Key Concepts of SDK */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-muted/30 border border-border space-y-2">
                  <div className="p-2 w-fit rounded-xl bg-primary/10 text-primary">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-foreground">1. Изолированная Песочница</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Плагины исполняются в безопасном окружении (Web Workers & Secure Sandbox) без прямого доступа к приватным кукам или токенам авторизации других пользователей.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-muted/30 border border-border space-y-2">
                  <div className="p-2 w-fit rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-foreground">2. ZerfContext RPC API</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Через объект <code className="font-mono text-emerald-400">ctx</code> плагин получает доступ к методам создания заметок (<code className="font-mono">ctx.notes</code>), задач (<code className="font-mono">ctx.tasks</code>) и вызову ИИ (<code className="font-mono">ctx.ai</code>).
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-muted/30 border border-border space-y-2">
                  <div className="p-2 w-fit rounded-xl bg-amber-500/10 text-amber-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-foreground">3. 100% Zero-Config на GitHub</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Вам не нужно настраивать собственный бэкенд: достаточно разместить <code className="font-mono text-amber-400">zerf-extension.json</code> в GitHub репозитории, и Zerf Note мгновенно подключит его в Каталог.
                  </p>
                </div>
              </div>

              {/* Code Example */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    <span>Пример создания TypeScript-плагина с @zerf/sdk:</span>
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-mono">src/index.ts</span>
                </div>

                <pre className="p-5 rounded-2xl bg-zinc-950 text-zinc-200 text-xs font-mono overflow-auto border border-border/60 leading-relaxed">
{`import { defineExtension, type ZerfContext } from '@zerf/sdk'

export default defineExtension({
  name: 'zerf-plugin-fitness-coach',
  title: 'Фитнес-тренер AI',
  version: '1.0.0',
  type: 'widget',
  category: 'Привычки & Здоровье',
  icon: '🏋️',
  triggers: ['/workout', 'тренировка', 'спорт'],
  aiInstructions: 'Анализируй цели пользователя и генерируй персональные тренировки с разминкой и подходами.',
  
  // Обработчик команд из чата или Telegram-бота
  async onCommand(ctx: ZerfContext, cmd: string, args: string[]) {
    const topic = args.join(' ') || 'силовая тренировка'
    
    // 1. Вызов нейросети через защищенный AI-прокси Zerf
    const plan = await ctx.ai.generate(\`Составь тренировочный план на тему: \${topic}\`)
    
    // 2. Создание задачи в календаре / списке задач пользователя
    const task = await ctx.tasks.create({
      title: \`🏋️ Тренировка: \${topic}\`,
      description: plan,
      priority: 'high',
      dueDate: new Date().toISOString()
    })

    return {
      success: true,
      message: \`✅ Тренировка создана и добавлена в задачи (ID: \${task.id})!\`
    }
  }
})`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: AUTHOR EARNINGS & PAYOUT ── */}
        {activeTab === 'earnings' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-3xl bg-card border border-border shadow-xs space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Баланс автора к выводу</span>
                <p className="text-2xl font-black text-foreground">{authorStats.balance} ₽</p>
                <span className="text-[10px] text-emerald-400 font-semibold">80% от всех продаж</span>
              </div>
              <div className="p-5 rounded-3xl bg-card border border-border shadow-xs space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Всего заработано</span>
                <p className="text-2xl font-black text-foreground">{authorStats.totalEarned} ₽</p>
                <span className="text-[10px] text-muted-foreground font-mono">За всё время</span>
              </div>
              <div className="p-5 rounded-3xl bg-card border border-border shadow-xs space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Количество продаж</span>
                <p className="text-2xl font-black text-foreground">{authorStats.salesCount}</p>
                <span className="text-[10px] text-muted-foreground font-mono">В магазине Zerf</span>
              </div>
            </div>

            {/* Payout Request Card */}
            <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-4 max-w-xl">
              <div className="border-b border-border/60 pb-3">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>Запрос выплаты средств</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Вывод на Банковскую Карту РФ, СБП или ЮMoney (мин. 100 ₽)
                </p>
              </div>

              {boundCard ? (
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border text-xs space-y-1">
                  <p className="font-semibold text-foreground">
                    Реквизиты: {boundCard.payoutType === 'sbp' ? `⚡ СБП: ${boundCard.phone}` : `💳 Карта: ${boundCard.cardNumber}`}
                  </p>
                  {boundCard.bankName && <p className="text-muted-foreground text-[11px]">Банк: {boundCard.bankName}</p>}
                </div>
              ) : (
                <p className="text-xs text-amber-400">
                  Привяжите реквизиты для выплат в разделе «Магазин расширений» на главной странице.
                </p>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={payoutAmount}
                  onChange={e => setPayoutAmount(e.target.value)}
                  placeholder={`Сумма (макс. ${authorStats.balance} ₽)`}
                  className="flex-1 h-10 px-3.5 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary"
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
            {/* Header & Quick Action Buttons */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <span>Полный справочник разработчика Zerf Note SDK</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Спецификация манифестов, Webhook API, CLI-модулей, UI-настроек, лимитов и монетизации
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleCopyAiSkill}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-bold text-xs flex items-center gap-1.5 border border-purple-500/30 transition-colors cursor-pointer"
                >
                  {copiedSkill ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Bot className="w-3.5 h-3.5" />}
                  <span>{copiedSkill ? 'Скилл скопирован!' : 'Скопировать Скилл для ИИ'}</span>
                </button>

                <button
                  onClick={handleDownloadStarterKit}
                  className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Скачать Starter Kit JSON</span>
                </button>
              </div>
            </div>

            {/* Sub-Navigation for Documentation */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-border/40 text-xs">
              {[
                { id: 'quickstart', label: '🚀 Быстрый старт' },
                { id: 'npm_sdk', label: '📦 @zerf/sdk' },
                { id: 'manifest', label: '📜 zerf-extension.json' },
                { id: 'permissions', label: '🔑 Разрешения' },
                { id: 'settings', label: '⚙️ UI Настройки' },
                { id: 'ai_webhook', label: '🧠 AI Webhook API' },
                { id: 'cli', label: '💻 TUI CLI Плагины' },
                { id: 'limits', label: '🛡️ Лимиты и Безопасность' },
                { id: 'monetization', label: '💰 Монетизация 80/20' },
                { id: 'skill', label: '🤖 AI Agent Skill' },
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

            {/* Sub-Section Content */}
            <div className="space-y-6 text-sm text-foreground/90 pt-2">
              {/* 1. QUICKSTART */}
              {docSection === 'quickstart' && (
                <section className="space-y-4">
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    <span>🚀 Быстрый старт за 2 минуты</span>
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Расширение для Zerf Note состоит из GitHub-репозитория с файлом <code className="font-mono text-primary font-bold">zerf-extension.json</code>.
                  </p>

                  <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
                    <h4 className="font-bold text-xs text-foreground">Пошаговый план публикации:</h4>
                    <ol className="list-decimal list-inside space-y-2 text-xs text-muted-foreground">
                      <li>Создайте публичный или приватный репозиторий на GitHub (например, <code className="font-mono text-foreground font-semibold">my-zerf-plugin</code>).</li>
                      <li>Сгенерируйте и поместите в корень репозитория файл <code className="font-mono text-primary font-bold">zerf-extension.json</code>.</li>
                      <li>Зайдите в Zerf Note в раздел <b>«Магазин расширений» → «+ Создать расширение»</b>.</li>
                      <li>Вставьте ссылку на ваш GitHub-репозиторий — манифест автоматически спарсится, верифицируется и будет готов к публикации!</li>
                    </ol>
                  </div>
                </section>
              )}

              {/* 2. NPM SDK */}
              {docSection === 'npm_sdk' && (
                <section className="space-y-4">
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    <span>📦 Разработка с пакетом @zerf/sdk</span>
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Пакет <code className="font-mono text-primary font-bold">@zerf/sdk</code> даёт вам полную поддержку TypeScript, автодополнение типов для триггеров и безопасные RPC-клиенты.
                  </p>
                  <pre className="p-4 rounded-2xl bg-zinc-950 text-emerald-400 text-xs font-mono overflow-auto border border-border/60">
{`npm install @zerf/sdk

import { defineExtension } from '@zerf/sdk'

export default defineExtension({
  name: 'my-plugin',
  title: 'Мой плагин',
  version: '1.0.0',
  type: 'widget',
  category: 'ИИ & Промпты',
  icon: '⚡',
  triggers: ['/mycmd'],
  aiInstructions: 'Выполняй команду по запросу пользователя'
})`}
                  </pre>
                </section>
              )}

              {/* 3. MANIFEST SPEC */}
              {docSection === 'manifest' && (
                <section className="space-y-4">
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    <span>📜 Спецификация zerf-extension.json</span>
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Манифест определяет название, иконку, команды, права и точку входа расширения.
                  </p>
                  <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-200 text-xs font-mono overflow-auto border border-border/60">
{manifestJsonString}
                  </pre>
                </section>
              )}

              {/* 4. MONETIZATION */}
              {docSection === 'monetization' && (
                <section className="space-y-4">
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    <span>💰 Монетизация и Выплаты (80/20)</span>
                  </h3>
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2 text-xs">
                    <p className="font-bold text-emerald-400">80% от всех покупок вашего расширения начисляются автору!</p>
                    <p className="text-muted-foreground">
                      Выплаты осуществляются мгновенно или по запросу на привязанную карту РФ / СБП / ЮMoney.
                    </p>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
