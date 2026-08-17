'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code2, Sparkles, BookOpen, Layers, Zap, Copy, Check,
  ExternalLink, Terminal, Shield, ArrowRight, ArrowLeft,
  DollarSign, CheckCircle2, AlertCircle, Play, RefreshCw,
  FolderPlus, Download, Send, Globe, Key, Lock, Puzzle, Eye,
  FileText, Cpu, CheckSquare, Bookmark, Flame, Lightbulb, Box, Bot
} from 'lucide-react'
import { getAuthHeaders } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { ExtensionItem } from '@/lib/backend/extensions'

export default function DeveloperPage() {
  const [activeTab, setActiveTab] = useState<'manifest' | 'tester' | 'earnings' | 'docs'>('manifest')
  const [docSection, setDocSection] = useState<'quickstart' | 'manifest' | 'permissions' | 'settings' | 'ai_webhook' | 'cli' | 'limits' | 'monetization' | 'skill'>('quickstart')
  const [copiedJson, setCopiedJson] = useState(false)
  const [copiedSkill, setCopiedSkill] = useState(false)
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

  // AI Sandbox State
  const [testEndpoint, setTestEndpoint] = useState('https://httpbin.org/post')
  const [testMessage, setTestMessage] = useState('Сравни архитектуру Transformers и Mamba')
  const [testResponse, setTestResponse] = useState<string | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)

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
      if (tabParam === 'docs' || tabParam === 'manifest' || tabParam === 'tester' || tabParam === 'earnings') {
        setActiveTab(tabParam)
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
    // Downloads zerf-extension.json
    handleDownloadManifest()
  }

  const handleTestEndpoint = async () => {
    if (!testEndpoint) return
    setTestLoading(true)
    setTestError(null)
    setTestResponse(null)

    try {
      if (!testEndpoint.startsWith('https://')) {
        setTestError('❌ Разрешены только HTTPS эндпоинты.')
        setTestLoading(false)
        return
      }

      const res = await fetch(testEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'u_developer_sandbox',
          message: testMessage,
          extensionId: 'sandbox_test',
          context: { plan: 'plus' },
        }),
      })

      const text = await res.text()
      try {
        const json = JSON.parse(text)
        setTestResponse(JSON.stringify(json, null, 2))
      } catch {
        setTestResponse(text)
      }
    } catch (err: any) {
      setTestError(`Ошибка запроса: ${err?.message || String(err)}`)
    } finally {
      setTestLoading(false)
    }
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
          { id: 'manifest', label: '🛠 Генератор zerf-extension.json', icon: FolderPlus },
          { id: 'tester', label: '🧪 Тестер AI-эндпоинта', icon: Zap },
          { id: 'earnings', label: '💰 Монетизация & Выплаты (80%)', icon: DollarSign },
          { id: 'docs', label: '📖 Полная документация SDK', icon: BookOpen },
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
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Загрузить универсальный шаблон</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Builder */}
              <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <FolderPlus className="w-4 h-4 text-primary" />
                    <span>Параметры расширения</span>
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-mono">zerf-extension.json</span>
                </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">ID пакета (slug)</label>
                  <input
                    type="text"
                    value={mName}
                    onChange={e => setMName(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Название (Title)</label>
                  <input
                    type="text"
                    value={mTitle}
                    onChange={e => setMTitle(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Категория</label>
                  <select
                    value={mCategory}
                    onChange={e => setMCategory(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value="ИИ & Промпты">ИИ & Промпты</option>
                    <option value="Продуктивность">Продуктивность</option>
                    <option value="Инженерия">Инженерия</option>
                    <option value="Утилиты">Утилиты</option>
                    <option value="Шаблоны">Шаблоны</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Иконка (Эмодзи)</label>
                  <input
                    type="text"
                    value={mIcon}
                    onChange={e => setMIcon(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Цена в рублях (0 = Бесплатно)</label>
                  <input
                    type="number"
                    value={mPrice}
                    onChange={e => setMPrice(Number(e.target.value))}
                    min={0}
                    max={5000}
                    className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Мин. тариф пользователя</label>
                  <select
                    value={mMinPlan}
                    onChange={e => setMMinPlan(e.target.value as any)}
                    className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value="free">Free (0 ₽)</option>
                    <option value="plus">Plus (99 ₽)</option>
                    <option value="pro">Pro (299 ₽)</option>
                    <option value="corp">Corp</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Описание</label>
                <textarea
                  value={mDescription}
                  onChange={e => setMDescription(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Инструкция для ИИ (aiInstructions)</label>
                <textarea
                  value={mAiInstructions}
                  onChange={e => setMAiInstructions(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Триггеры команд (через запятую)</label>
                <input
                  type="text"
                  value={mTriggers}
                  onChange={e => setMTriggers(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">HTTPS AI Endpoint (опционально)</label>
                <input
                  type="text"
                  value={mEndpoint}
                  onChange={e => setMEndpoint(e.target.value)}
                  placeholder="https://api.yourdomain.com/v1/zerf-hook"
                  className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary font-mono"
                />
              </div>
            </div>

            {/* Live JSON Preview */}
            <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-purple-400" />
                    <span>Сгенерированный zerf-extension.json</span>
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleCopyManifest}
                      className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold flex items-center gap-1 border border-border transition-colors cursor-pointer"
                    >
                      {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedJson ? 'Скопировано!' : 'Копировать'}</span>
                    </button>
                    <button
                      onClick={handleDownloadManifest}
                      className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Скачать JSON</span>
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-200 text-xs font-mono overflow-auto max-h-[460px] border border-border/60 leading-relaxed">
                    {manifestJsonString}
                  </pre>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 text-xs text-muted-foreground leading-relaxed flex items-center justify-between gap-3">
                <p>Поместите этот файл в корень вашего репозитория на GitHub как <code className="font-mono text-foreground font-bold">zerf-extension.json</code>.</p>
                <a
                  href="https://github.com/new"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-card hover:bg-muted border border-border text-foreground font-semibold text-xs flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>GitHub</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* ── TAB 2: AI ENDPOINT SANDBOX ── */}
        {activeTab === 'tester' && (
          <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-6 max-w-3xl mx-auto">
            <div className="border-b border-border/60 pb-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Эмулятор и верификатор внешнего AI-вебхука</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Проверка формата ответа, валидация SSL-сертификата и проверка защиты от SSRF
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">HTTPS AI Endpoint URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={testEndpoint}
                    onChange={e => setTestEndpoint(e.target.value)}
                    placeholder="https://api.yourdomain.com/v1/zerf-hook"
                    className="flex-1 h-10 px-3.5 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary font-mono"
                  />
                  <button
                    onClick={handleTestEndpoint}
                    disabled={testLoading || !testEndpoint}
                    className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-xs disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    {testLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>Проверить эндпоинт</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Тестовое сообщение пользователя</label>
                <input
                  type="text"
                  value={testMessage}
                  onChange={e => setTestMessage(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              {testError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{testError}</span>
                </div>
              )}

              {testResponse && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ответ сервера (200 OK):</span>
                    </span>
                  </div>
                  <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-200 text-xs font-mono overflow-auto max-h-[300px] border border-border/60">
                    {testResponse}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: AUTHOR EARNINGS & PAYOUT ── */}
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

        {/* ── TAB 4: COMPREHENSIVE SDK DOCUMENTATION ── */}
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

                  <div className="p-4 rounded-2xl bg-zinc-950 text-zinc-200 text-xs font-mono border border-border/60 space-y-1">
                    <p className="text-muted-foreground"># Структура репозитория:</p>
                    <p>my-zerf-extension/</p>
                    <p>├── <span className="text-primary font-bold">zerf-extension.json</span>    <span className="text-muted-foreground"># ОБЯЗАТЕЛЬНО: Манифест</span></p>
                    <p>├── index.js               <span className="text-muted-foreground"># Опционально: Код для CLI (ESM)</span></p>
                    <p>├── README.md              <span className="text-muted-foreground"># Описание для витрины</span></p>
                    <p>└── package.json           <span className="text-muted-foreground"># Зависимости</span></p>
                  </div>

                  <ol className="list-decimal pl-5 text-xs text-muted-foreground space-y-2 leading-relaxed">
                    <li>Сгенерируйте манифест во вкладке <b>«Генератор манифеста»</b> выше.</li>
                    <li>Создайте публичный репозиторий на GitHub и добавьте файл <code className="font-mono text-foreground font-bold">zerf-extension.json</code>.</li>
                    <li>Вставьте ссылку на репозиторий в Магазине расширений и нажмите <b>«Опубликовать»</b>.</li>
                  </ol>
                </section>
              )}

              {/* 2. MANIFEST SPEC */}
              {docSection === 'manifest' && (
                <section className="space-y-4">
                  <h3 className="font-bold text-base text-foreground">📜 Спецификация zerf-extension.json</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border border-border rounded-xl">
                      <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border">
                        <tr>
                          <th className="p-2.5">Поле</th>
                          <th className="p-2.5">Тип</th>
                          <th className="p-2.5">Обязательно</th>
                          <th className="p-2.5">Описание</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-foreground/80">
                        <tr>
                          <td className="p-2.5 font-mono text-primary font-bold">name</td>
                          <td className="p-2.5 font-mono">string</td>
                          <td className="p-2.5 text-emerald-400 font-bold">Да</td>
                          <td className="p-2.5">Уникальный ID пакета (латиница, цифры, дефис).</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-mono text-primary font-bold">title</td>
                          <td className="p-2.5 font-mono">string</td>
                          <td className="p-2.5 text-emerald-400 font-bold">Да</td>
                          <td className="p-2.5">Отображаемое название в каталоге.</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-mono text-primary font-bold">type</td>
                          <td className="p-2.5 font-mono">string</td>
                          <td className="p-2.5 text-emerald-400 font-bold">Да</td>
                          <td className="p-2.5">widget, template, theme, integration, prompt</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-mono text-primary font-bold">category</td>
                          <td className="p-2.5 font-mono">string</td>
                          <td className="p-2.5 text-emerald-400 font-bold">Да</td>
                          <td className="p-2.5">ИИ & Промпты, Продуктивность, Инженерия, Финансы, Утилиты</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-mono text-primary font-bold">price</td>
                          <td className="p-2.5 font-mono">number</td>
                          <td className="p-2.5 text-muted-foreground">Нет</td>
                          <td className="p-2.5">Цена в рублях (0 = Бесплатно). Покупка через ЮMoney.</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-mono text-primary font-bold">aiInstructions</td>
                          <td className="p-2.5 font-mono">string</td>
                          <td className="p-2.5 text-muted-foreground">Нет</td>
                          <td className="p-2.5">Системный промпт для внедрения в веб-чат и Telegram-бота.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* 3. PERMISSIONS */}
              {docSection === 'permissions' && (
                <section className="space-y-4">
                  <h3 className="font-bold text-base text-foreground">🔑 Система разрешений (Permissions)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-card border border-border space-y-1">
                      <code className="font-mono text-primary font-bold">tasks:read / tasks:write</code>
                      <p className="text-muted-foreground">Доступ к чтению и автоматическому созданию задач пользователя.</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-card border border-border space-y-1">
                      <code className="font-mono text-primary font-bold">notes:read / notes:write</code>
                      <p className="text-muted-foreground">Доступ к заметкам, сохранению отчетов и экспорту базы знаний.</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-card border border-border space-y-1">
                      <code className="font-mono text-primary font-bold">reminders:write</code>
                      <p className="text-muted-foreground">Установка системных и фоновых напоминаний.</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-card border border-border space-y-1">
                      <code className="font-mono text-primary font-bold">ai:proxy</code>
                      <p className="text-muted-foreground">Доступ к защищенному маршруту проксирования POST /api/extensions/ai.</p>
                    </div>
                  </div>
                </section>
              )}

              {/* 4. SETTINGS SCHEMA */}
              {docSection === 'settings' && (
                <section className="space-y-4">
                  <h3 className="font-bold text-base text-foreground">⚙️ Декларативная схема настроек (Settings Schema)</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Массив <code className="font-mono text-foreground font-bold">content.settingsSchema</code> автоматически генерирует интерфейс настроек в веб-приложении:
                  </p>
                  <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-200 text-xs font-mono border border-border/60">
{`"settingsSchema": [
  { "key": "apiKey", "label": "Секретный API-ключ", "type": "secret" },
  { "key": "maxResults", "label": "Лимит результатов", "type": "number", "defaultValue": 5 },
  { "key": "autoSync", "label": "Автосинхронизация", "type": "boolean", "defaultValue": true },
  { "key": "themeColor", "label": "Цвет акцента", "type": "color", "defaultValue": "#22C55E" }
]`}
                  </pre>
                </section>
              )}

              {/* 5. AI WEBHOOK API */}
              {docSection === 'ai_webhook' && (
                <section className="space-y-4">
                  <h3 className="font-bold text-base text-foreground">🧠 Спецификация AI Webhook API</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Сервер Zerf отправляет POST-запрос на ваш <code className="font-mono text-foreground font-bold">content.aiEndpoint</code>:
                  </p>
                  <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-200 text-xs font-mono border border-border/60">
{`// POST https://api.yourdomain.com/v1/zerf-hook
{
  "userId": "u_a1b2c3d4",
  "message": "Сравни архитектуру Transformer и Mamba",
  "action": "research",
  "extensionId": "zerf-plugin-research",
  "context": {
    "plan": "plus",
    "timezone": "Europe/Moscow"
  }
}`}
                  </pre>
                </section>
              )}

              {/* 6. CLI */}
              {docSection === 'cli' && (
                <section className="space-y-4">
                  <h3 className="font-bold text-base text-foreground">💻 Разработка плагинов для TUI CLI (`index.js`)</h3>
                  <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-200 text-xs font-mono border border-border/60">
{`// index.js (ES Module)
export default {
  async onLoad(ctx) {
    ctx.log.info('Плагин активирован');
  },
  async onCommand(cmd, args, ctx) {
    const tasks = await ctx.api.getTasks();
    ctx.log.success(\`Активных задач: \${tasks.length}\`);
  }
};`}
                  </pre>
                </section>
              )}

              {/* 7. LIMITS & SECURITY */}
              {docSection === 'limits' && (
                <section className="space-y-4">
                  <h3 className="font-bold text-base text-foreground">🛡️ Лимиты и Безопасность (SSRF & Anti-Abuse)</h3>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                    <li><b>Только HTTPS</b>: HTTP-эндпоинты блокируются.</li>
                    <li><b>SSRF Защита</b>: Локальные IP (127.0.0.1, 10.x, 192.168.x, 172.16.x, ::1) блокируются на уровне DNS.</li>
                    <li><b>Таймаут</b>: 8 секунд на запрос. Максимальный размер ответа: 50 КБ.</li>
                    <li><b>Суточные квоты аккаунтов на ИИ для расширений</b>:
                      <ul className="list-disc pl-5 mt-1 space-y-0.5">
                        <li>Free: <b>10 запросов / день</b></li>
                        <li>Plus: <b>50 запросов / день</b></li>
                        <li>Pro: <b>150 запросов / день</b></li>
                        <li>Corp: <b>300 запросов / день</b></li>
                        <li>Creator / Admin: <b>Безлимит</b></li>
                      </ul>
                    </li>
                  </ul>
                </section>
              )}

              {/* 8. MONETIZATION */}
              {docSection === 'monetization' && (
                <section className="space-y-4">
                  <h3 className="font-bold text-base text-foreground">💰 Монетизация и Выплаты (80/20)</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Автор получает <b>80%</b> от каждой продажи платного расширения. Покупки проходят через защищенный шлюз <b>ЮMoney</b>. Вывод средств доступен от 100 ₽ во вкладке <b>«Монетизация & Выплаты»</b>.
                  </p>
                </section>
              )}

              {/* 9. AI AGENT SKILL */}
              {docSection === 'skill' && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-foreground">🤖 Системный промпт / Скилл для ИИ</h3>
                    <button
                      onClick={handleCopyAiSkill}
                      className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSkill ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSkill ? 'Скопировано!' : 'Копировать'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Скопируйте этот текст и скормите любой нейросети (ChatGPT, Claude, Cursor, Gemini), чтобы она написала для вас готовое расширение под стандарты Zerf Note:
                  </p>
                  <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-200 text-xs font-mono border border-border/60 overflow-x-auto leading-relaxed">
{AI_SKILL_PROMPT}
                  </pre>
                </section>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
