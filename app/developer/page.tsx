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
  CreditCard, Info, Activity, Radio, Award, Palette, Monitor,
  Upload, Trash2, Search, Sliders, MessageSquare, ListTodo, Target,
  ChevronDown, ToggleLeft, ToggleRight, Database, Share2, CornerDownRight,
  Workflow, Compass, AlertTriangle, ShieldCheck
} from 'lucide-react'
import { getAuthHeaders } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { ExtensionItem } from '@/lib/backend/extensions'

type NavSection =
  | 'manifest_builder'
  | 'universal_template'
  | 'import_export'
  | 'live_sandbox'
  | 'webhook_tester'
  | 'publish_github'
  | 'my_releases'
  | 'ai_prompts'
  | 'ui_kit'
  | 'inter_ai_protocol'
  | 'earnings'
  | 'sdk_docs'
  | 'cli_tools'

const THEME_OPTIONS = [
  { id: 'dark', label: 'Dark Default', bg: 'bg-[#09090b]', text: 'text-zinc-100', border: 'border-zinc-800' },
  { id: 'light', label: 'Light Clean', bg: 'bg-zinc-50', text: 'text-zinc-900', border: 'border-zinc-200' },
  { id: 'oled', label: 'OLED Pure Black', bg: 'bg-black', text: 'text-white', border: 'border-zinc-900' },
  { id: 'cyberpunk', label: 'Cyberpunk Neon', bg: 'bg-[#0a0518]', text: 'text-cyan-300', border: 'border-fuchsia-500/40' },
  { id: 'forest', label: 'Emerald Forest', bg: 'bg-[#06140d]', text: 'text-emerald-300', border: 'border-emerald-800/40' },
  { id: 'sunset', label: 'Sunset Amber', bg: 'bg-[#150a06]', text: 'text-amber-300', border: 'border-amber-800/40' },
  { id: 'aurora', label: 'Nordic Aurora', bg: 'bg-[#040f1a]', text: 'text-teal-300', border: 'border-teal-800/40' },
  { id: 'sakura', label: 'Sakura Pink', bg: 'bg-[#150810]', text: 'text-pink-300', border: 'border-pink-800/40' },
]

export default function DeveloperPage() {
  const [navSection, setNavSection] = useState<NavSection>('manifest_builder')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchNav, setSearchNav] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Manifest Builder Form State
  const [mName, setMName] = useState('zerf-plugin-research')
  const [mTitle, setMTitle] = useState('Deep Research & Synthesizer')
  const [mVersion, setMVersion] = useState('1.0.0')
  const [mDescription, setMDescription] = useState('Интеллектуальный поиск первоисточников, глубокий синтез фактов и авто-генерация заметок.')
  const [mCategory, setMCategory] = useState('ИИ & Промпты')
  const [mType, setMType] = useState<'widget' | 'template' | 'theme' | 'integration' | 'prompt'>('widget')
  const [mIcon, setMIcon] = useState('🔮')
  const [mAuthor, setMAuthor] = useState('waters1ze')
  const [mPrice, setMPrice] = useState<number>(0)
  const [mMinPlan, setMMinPlan] = useState<'free' | 'plus' | 'pro' | 'corp'>('plus')
  const [mIsRunnable, setMIsRunnable] = useState(true)
  const [mAiInstructions, setMAiInstructions] = useState('Когда пользователь запрашивает исследование темы, структурируй вывод по 3 пунктам, сгенерируй выводы и предложи создать задачи в Zerf Note.')
  const [mTriggers, setMTriggers] = useState('/research, исследуй тему, найди факты')
  const [mEndpoint, setMEndpoint] = useState('https://api.yourdomain.com/v1/zerf-hook')

  // Live Sandbox & Code Runner State
  const [sandboxCode, setSandboxCode] = useState(`// Zerf Widget Live Code Runner
// Access mock ZerfContext directly
const { tasks, notes, user, ai } = ZerfContext

console.log("⚡ Widget mounted in sandbox for user:", user.name)

async function runAction(promptText) {
  console.log("🚀 Executing action with prompt:", promptText)
  
  // Create note
  const note = await ZerfContext.notes.create({
    title: "Исследование: " + (promptText || "Без названия"),
    body: "Синтез данных выполнен в Live Sandbox.\\n1. Анализ трендов\\n2. Ключевые метрики\\n3. Стратегия"
  })
  
  // Create task
  const task = await ZerfContext.tasks.create({
    title: "Внедрить результаты исследования (" + (promptText || "Новая задача") + ")",
    priority: "high",
    dueDate: new Date(Date.now() + 86400000).toISOString()
  })

  return {
    success: true,
    createdNoteId: note.id,
    createdTaskId: task.id,
    message: "Анализ успешно завершен! Созданы 1 заметка и 1 задача."
  }
}`)
  const [sandboxTheme, setSandboxTheme] = useState('dark')
  const [sandboxCommand, setSandboxCommand] = useState('/research ИИ агенты 2026')
  const [sandboxRunning, setSandboxRunning] = useState(false)
  const [sandboxTasks, setSandboxTasks] = useState<Array<{ id: string; title: string; priority: string; done: boolean }>>([
    { id: 't-1', title: 'Проанализировать ключевые выводы по ИИ трендам 2026', priority: 'high', done: false },
    { id: 't-2', title: 'Подключить Zerf SDK к новому виджету', priority: 'medium', done: true }
  ])
  const [sandboxNotes, setSandboxNotes] = useState<Array<{ id: string; title: string; body: string }>>([
    { id: 'n-1', title: 'Заметка: Архитектура расширений Zerf', body: 'Манифест zerf-extension.json, права доступа и Webhook API.' }
  ])
  const [sandboxLogs, setSandboxLogs] = useState<Array<{ id: string; time: string; type: 'info' | 'success' | 'warn' | 'rpc'; msg: string }>>([
    { id: '1', time: '20:30:00', type: 'info', msg: '⚡ Zerf Sandbox VM v2.6 инициализирована.' },
    { id: '2', time: '20:30:01', type: 'success', msg: '✓ Схема zerf-extension.json валидна (0 предупреждений).' },
  ])
  const [sandboxOutput, setSandboxOutput] = useState<{
    status: number
    latencyMs: number
    responseMessage: string
    createdTasks?: string[]
    createdNotes?: string[]
  } | null>({
    status: 200,
    latencyMs: 42,
    responseMessage: '🔍 Глубокий анализ выполнен. Найдено 4 источника. Синтез фактов завершён.',
    createdTasks: ['Проанализировать ключевые выводы по ИИ трендам 2026'],
    createdNotes: ['Заметка: Исследование ИИ трендов (4 первоисточника)'],
  })

  // Author Earnings & YooMoney State
  const [authorStats, setAuthorStats] = useState({ balance: 0, totalEarned: 0, salesCount: 0 })
  const [myExtensions, setMyExtensions] = useState<ExtensionItem[]>([])
  const [boundCard, setBoundCard] = useState<any>(null)
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [userGh, setUserGh] = useState<string | null>(null)
  const [showDevYoomoneyModal, setShowDevYoomoneyModal] = useState(false)
  const [devCardPayoutType, setDevCardPayoutType] = useState<'card' | 'yoomoney'>('yoomoney')
  const [devCardNumber, setDevCardNumber] = useState<string>('')
  const [devCardBank, setDevCardBank] = useState<string>('')
  const [showDevBankDropdown, setShowDevBankDropdown] = useState<boolean>(false)

  const POPULAR_BANKS_LIST = [
    { name: 'ЮMoney', icon: '🟣', badge: 'Кошелёк / Карта' },
    { name: 'Сбербанк', icon: '🟢', badge: 'Сбер' },
    { name: 'Т-Банк', icon: '🟡', badge: 'Тинькофф' },
    { name: 'Альфа-Банк', icon: '🔴', badge: 'Альфа' },
    { name: 'ВТБ', icon: '🔵', badge: 'ВТБ' },
    { name: 'Ozon Банк', icon: '🟣', badge: 'Ozon' },
    { name: 'Райффайзен', icon: '🟠', badge: 'Райф' },
    { name: 'Газпромбанк', icon: '🔵', badge: 'ГПБ' },
    { name: 'Другой банк', icon: '💳', badge: 'Карта РФ' },
  ]

  // GitHub Publish & Validation State
  const [publishRepoUrl, setPublishRepoUrl] = useState('')
  const [publishValidating, setPublishValidating] = useState(false)
  const [publishValidation, setPublishValidation] = useState<{
    tested: boolean
    valid: boolean
    owner: string
    repo: string
    ownerMatches: boolean
    manifestFound: boolean
    manifest?: any
    errors: string[]
  } | null>(null)

  // AI Prompts Section State
  const [activePromptTab, setActivePromptTab] = useState<'cursor_skill' | 'theme_styler' | 'action_protocol'>('cursor_skill')

  // Copy helper
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2200)
  }

  // Load Initial Developer Stats
  const fetchDevData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/extensions', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) {
        setAuthorStats(data.authorStats || { balance: 0, totalEarned: 0, salesCount: 0 })
        if (data.boundCard) {
          setBoundCard(data.boundCard)
          setDevCardPayoutType(data.boundCard.payoutType === 'card' ? 'card' : 'yoomoney')
          setDevCardNumber(data.boundCard.cardNumber || '')
          setDevCardBank(data.boundCard.bankName || '')
        }
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
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const tabParam = urlParams.get('tab')
      if (tabParam) {
        if (tabParam === 'sandbox') setNavSection('live_sandbox')
        else if (tabParam === 'earnings') setNavSection('earnings')
        else if (tabParam === 'docs') setNavSection('sdk_docs')
        else if (tabParam === 'publish') setNavSection('publish_github')
        else if (tabParam === 'prompts') setNavSection('ai_prompts')
      }
      const gh = localStorage.getItem('zerf_user_github')
      if (gh) {
        setUserGh(gh)
        setMAuthor(gh)
      }
    }
    fetchDevData()
  }, [])

  // Save YooMoney Handler
  const handleSaveDevPayoutDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    setPayoutLoading(true)
    try {
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bind_payout_card',
          payoutType: devCardPayoutType,
          cardNumber: devCardNumber,
          bankName: devCardBank,
        }),
      })
      const d = await res.json()
      if (d.success) {
        setBoundCard(d.boundCard)
        setShowDevYoomoneyModal(false)
      } else {
        alert(d.error || 'Ошибка при сохранении реквизитов')
      }
    } catch {
      alert('Сетевая ошибка при сохранении')
    } finally {
      setPayoutLoading(false)
    }
  }

  // Handle Strict GitHub Validation
  const handleValidateGithubRepo = async () => {
    const raw = publishRepoUrl.trim()
    if (!raw) {
      alert('Введите ссылку на GitHub репозиторий')
      return
    }

    setPublishValidating(true)
    setPublishValidation(null)

    try {
      // Parse owner and repo from URL: https://github.com/owner/repo
      const clean = raw.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/$/, '')
      const parts = clean.split('/')
      if (parts.length < 2) {
        setPublishValidation({
          tested: true,
          valid: false,
          owner: '',
          repo: '',
          ownerMatches: false,
          manifestFound: false,
          errors: ['Неверный формат ссылки. Ожидается формат: https://github.com/owner/repo']
        })
        return
      }

      const repoOwner = parts[0].trim()
      const repoName = parts[1].trim()
      const ownerMatches = Boolean(userGh && userGh.toLowerCase() === repoOwner.toLowerCase())

      // Fetch zerf-extension.json from raw.githubusercontent.com
      const rawManifestUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/zerf-extension.json`
      let manifestData: any = null
      const errors: string[] = []

      if (!ownerMatches) {
        errors.push(`Владелец репозитория (@${repoOwner}) не совпадает с вашим привязанным GitHub аккаунтом (@${userGh || 'не привязан'}).`)
      }

      try {
        const resp = await fetch(rawManifestUrl)
        if (resp.ok) {
          manifestData = await resp.json()
          if (!manifestData.name) errors.push('В файле zerf-extension.json отсутствует обязательное поле "name"')
          if (!manifestData.title) errors.push('В файле zerf-extension.json отсутствует обязательное поле "title"')
        } else {
          // Try master branch fallback
          const respMaster = await fetch(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/master/zerf-extension.json`)
          if (respMaster.ok) {
            manifestData = await respMaster.json()
          } else {
            errors.push('Файл zerf-extension.json не найден в корне ветки main или master')
          }
        }
      } catch (err: any) {
        errors.push('Ошибка при загрузке zerf-extension.json: ' + (err?.message || 'Network error'))
      }

      setPublishValidation({
        tested: true,
        valid: errors.length === 0,
        owner: repoOwner,
        repo: repoName,
        ownerMatches,
        manifestFound: Boolean(manifestData),
        manifest: manifestData,
        errors
      })
    } catch (e: any) {
      setPublishValidation({
        tested: true,
        valid: false,
        owner: '',
        repo: '',
        ownerMatches: false,
        manifestFound: false,
        errors: ['Ошибка валидации: ' + (e?.message || 'Неизвестная ошибка')]
      })
    } finally {
      setPublishValidating(false)
    }
  }

  // Handle Publish From GitHub
  const handlePublishNow = async () => {
    if (!publishValidation || !publishValidation.manifest) return
    setLoading(true)
    try {
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_extension',
          githubUrl: publishRepoUrl.trim(),
          manifest: publishValidation.manifest,
        }),
      })
      const d = await res.json()
      if (d.success) {
        alert('🎉 Расширение успешно опубликовано в Каталог Zerf Note!')
        setNavSection('my_releases')
        fetchDevData()
      } else {
        alert(d.error || 'Ошибка при публикации')
      }
    } catch {
      alert('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

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
    price: mPrice,
    minPlan: mMinPlan,
    isRunnable: mIsRunnable,
    permissions: ['tasks:read', 'tasks:write', 'notes:read', 'notes:write', 'ai:stream', 'notifications:send'],
    ai: {
      instructions: mAiInstructions,
      triggers: mTriggers.split(',').map(s => s.trim()).filter(Boolean),
    },
    webhook: {
      endpoint: mEndpoint,
      timeoutMs: 8000,
    },
    settingsSchema: {
      apiKey: {
        type: 'string',
        title: 'Custom API Key',
        description: 'Ваш секретный API-ключ для локального выполнения',
        secret: true,
      },
      enableAlerts: {
        type: 'boolean',
        title: 'Включить уведомления',
        default: true,
      }
    }
  }
  const manifestJsonString = JSON.stringify(generatedManifest, null, 2)

  // Universal template loader
  const handleLoadUniversalTemplate = () => {
    setMName('zerf-ai-autonomous-planner')
    setMTitle('Autonomous AI Sprint Planner')
    setMVersion('1.2.0')
    setMDescription('Автономный агент декомпозиции целей в спринты, анализ блокеров и синхронизация с календарем.')
    setMCategory('Продуктивность')
    setMType('widget')
    setMIcon('⚡')
    setMPrice(199)
    setMMinPlan('pro')
    setMIsRunnable(true)
    setMAiInstructions('Анализируй загруженные цели пользователя. Разбивай цель на 3 фазы, рассчитывай трудозатраты в часах и создавай задачи с приоритетами.')
    setMTriggers('/sprint, спланируй спринт, декомпозируй проект')
    setMEndpoint('https://api.yourdomain.com/v1/sprint-planner')
  }

  // Run Sandbox Code Simulator
  const handleRunSandbox = () => {
    setSandboxRunning(true)
    const timeStr = new Date().toLocaleTimeString()

    setSandboxLogs(prev => [
      ...prev,
      { id: String(Date.now()), time: timeStr, type: 'info', msg: `▶ Запуск команды: "${sandboxCommand}"` },
      { id: String(Date.now() + 1), time: timeStr, type: 'rpc', msg: 'ZerfContext.ai.prompt -> Обработка инструкций манифеста...' }
    ])

    setTimeout(() => {
      const newTaskId = `t-${Date.now()}`
      const newNoteId = `n-${Date.now()}`
      
      const newCreatedTask = {
        id: newTaskId,
        title: `Задача из команды: ${sandboxCommand.replace(/^\/\w+\s*/, '') || 'Новая задача'}`,
        priority: 'high',
        done: false
      }
      const newCreatedNote = {
        id: newNoteId,
        title: `Заметка: Результат ${mTitle}`,
        body: `Сгенерировано в Live Sandbox по команде: ${sandboxCommand}\n\n1. Анализ выполнен\n2. Ключевые показатели зафиксированы\n3. Чек-лист готов.`
      }

      setSandboxTasks(prev => [newCreatedTask, ...prev])
      setSandboxNotes(prev => [newCreatedNote, ...prev])

      setSandboxLogs(prev => [
        ...prev,
        { id: String(Date.now() + 2), time: new Date().toLocaleTimeString(), type: 'success', msg: `✓ Создана задача ID: ${newTaskId}` },
        { id: String(Date.now() + 3), time: new Date().toLocaleTimeString(), type: 'success', msg: `✓ Создана заметка ID: ${newNoteId}` },
        { id: String(Date.now() + 4), time: new Date().toLocaleTimeString(), type: 'info', msg: '✨ Execution completed with exit code 0.' }
      ])

      setSandboxOutput({
        status: 200,
        latencyMs: Math.floor(Math.random() * 25) + 30,
        responseMessage: `Анализ команды "${sandboxCommand}" успешно завершён. Созданы 1 заметка и 1 задача.`,
        createdTasks: [newCreatedTask.title],
        createdNotes: [newCreatedNote.title]
      })

      setSandboxRunning(false)
    }, 600)
  }

  // Starter Kit Download Helper
  const handleDownloadStarterKit = () => {
    const starterZipContent = manifestJsonString
    const blob = new Blob([starterZipContent], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'zerf-extension.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  // AI Prompt Skill strings
  const CURSOR_AI_SKILL = `---
name: zerf-extension-builder
description: Expert AI rule for writing 100% compliant, modern Zerf Note extensions with Glassmorphism UI, ZerfContext SDK, and Action Protocol.
---

# Zerf Note Extension Development Guidelines

When creating extensions for Zerf Note:
1. **Manifest File**: Always create a root file \`zerf-extension.json\` adhering to Zerf Note Schema.
2. **Design System & UI**:
   - Use Tailwind CSS with Zerf CSS variables: \`bg-card\`, \`text-foreground\`, \`border-border\`, \`text-primary\`.
   - Support dark, OLED and light themes seamlessly using semantic classes.
   - Employ Glassmorphism: \`backdrop-blur-md\`, \`border-border/60\`, rounded corners \`rounded-2xl\` or \`rounded-3xl\`.
3. **SDK Context**:
   - Access global object \`ZerfContext\` with methods:
     - \`ZerfContext.tasks.create({ title, priority, dueDate })\`
     - \`ZerfContext.notes.create({ title, body })\`
     - \`ZerfContext.ai.prompt({ system, user })\`
     - \`ZerfContext.notifications.send({ title, body })\`
4. **Inter-AI Protocol**: Return JSON with standardized format:
   \`{ "message": "...", "actions": [{ "type": "create_task", "title": "..." }], "intent": "..." }\``

  const THEME_STYLER_PROMPT = `You are a Senior Frontend UI/UX Designer specialized in the Zerf Note Design System.
Generate extension widget UI conforming to the Zerf aesthetic:
- **Color Tokens**: Use \`bg-background\`, \`bg-card\`, \`text-foreground\`, \`text-muted-foreground\`, \`border-border\`, \`text-primary\`.
- **Theme Adaptability**: Do not hardcode dark colors like #000 or #fff directly; use Tailwind semantic tokens so widgets automatically adapt when users switch themes (OLED, Cyberpunk, Light, Emerald Forest).
- **Glassmorphism**: Soft background opacity (\`bg-card/80\`), subtle 1px border (\`border border-border/80\`), smooth hover states (\`hover:border-primary/40\`).
- **Typography**: Clean, readable sans-serif, font-bold for headers, text-xs / text-sm for dense productivity tools.`

  const ACTION_PROTOCOL_PROMPT = `Instructions for External AI models connected to Zerf Note via BYOK:
When processing user instructions and extension triggers, ALWAYS output your final response as a JSON object adhering to the Zerf Action Protocol:
{
  "message": "Human readable response for the user",
  "actions": [
    {
      "type": "create_task",
      "title": "Task title",
      "priority": "high" | "medium" | "low",
      "dueDate": "2026-08-20T18:00:00Z"
    },
    {
      "type": "create_note",
      "title": "Note title",
      "body": "Markdown content of note"
    }
  ],
  "intent": "productivity_action"
}`

  interface NavItem {
    id: string
    label: string
    icon: any
    badge?: string
    dotColor?: string
  }

  interface NavGroup {
    title: string
    items: NavItem[]
  }

  // Navigation Items
  const NAV_GROUPS: NavGroup[] = [
    {
      title: 'РАЗРАБОТКА & МАНИФЕСТЫ',
      items: [
        { id: 'manifest_builder', label: 'Конструктор манифеста', icon: Code2, badge: 'Visual' },
        { id: 'universal_template', label: 'Универсальный шаблон', icon: Sparkles, badge: 'Template' },
        { id: 'import_export', label: 'Импорт / Экспорт JSON', icon: Upload },
      ]
    },
    {
      title: 'ТЕСТИРОВАНИЕ & LIVE SANDBOX',
      items: [
        { id: 'live_sandbox', label: 'Live Sandbox & Изолятор', icon: Play, badge: 'Live VM', dotColor: 'bg-emerald-400' },
        { id: 'webhook_tester', label: 'Webhook & REST Tester', icon: Activity },
      ]
    },
    {
      title: 'ПУБЛИКАЦИЯ & GITHUB',
      items: [
        { id: 'publish_github', label: 'Публикация из GitHub', icon: Globe, badge: 'Проверка' },
        { id: 'my_releases', label: 'Мои плагины & Релизы', icon: Package, badge: myExtensions.length ? String(myExtensions.length) : undefined },
      ]
    },
    {
      title: 'AI ИНСТРУКЦИИ & SKILLS',
      items: [
        { id: 'ai_prompts', label: 'Промпты & Скиллы для AI', icon: Bot, badge: 'Cursor / GPT' },
        { id: 'ui_kit', label: 'UI Kit & Темы оформления', icon: Palette },
        { id: 'inter_ai_protocol', label: 'Двусторонний протокол', icon: Workflow },
      ]
    },
    {
      title: 'МОНЕТИЗАЦИЯ & БАЛАНС',
      items: [
        { id: 'earnings', label: 'Баланс автора (80/20)', icon: DollarSign, badge: `${authorStats.balance} ₽`, dotColor: 'bg-emerald-400' },
      ]
    },
    {
      title: 'СПРАВОЧНИК & SDK',
      items: [
        { id: 'sdk_docs', label: 'Справочник SDK API', icon: BookOpen },
        { id: 'cli_tools', label: 'Zerf CLI & Терминал', icon: Terminal },
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row antialiased selection:bg-primary/30">
      
      {/* ── LEFT SIDEBAR (Categorized Navigation matching user screenshot) ── */}
      <aside className={cn(
        'w-full md:w-72 bg-card/60 backdrop-blur-xl border-r border-border flex flex-col shrink-0 transition-all duration-200 z-30 sticky top-0 md:h-screen',
        sidebarCollapsed && 'md:w-20'
      )}>
        {/* User / Studio Profile Header */}
        <div className="p-4 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-primary text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0">
              🛠️
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
                  <span>Zerf Dev Studio</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </h2>
                <p className="text-[10px] text-muted-foreground truncate">
                  {userGh ? `@${userGh}` : 'v2.6 • SDK Ready'}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <a
              href="/"
              className="p-1.5 rounded-xl hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs transition-colors"
              title="Вернуться на главную"
            >
              <ArrowLeft className="w-4 h-4" />
            </a>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex p-1.5 rounded-xl hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs transition-colors"
              title={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
            >
              <ChevronRight className={cn('w-4 h-4 transition-transform', !sidebarCollapsed && 'rotate-180')} />
            </button>
          </div>
        </div>

        {/* Quick Search */}
        {!sidebarCollapsed && (
          <div className="px-3 pt-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchNav}
                onChange={e => setSearchNav(e.target.value)}
                placeholder="Поиск по инструментам..."
                className="w-full h-8 pl-8 pr-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-all"
              />
            </div>
          </div>
        )}

        {/* Navigation Groups */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs scrollbar-thin">
          {NAV_GROUPS.map((group, gIdx) => {
            const filteredItems = group.items.filter(it =>
              !searchNav || it.label.toLowerCase().includes(searchNav.toLowerCase())
            )
            if (filteredItems.length === 0) return null

            return (
              <div key={gIdx} className="space-y-1">
                {!sidebarCollapsed && (
                  <p className="px-2 text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
                    {group.title}
                  </p>
                )}

                <div className="space-y-0.5">
                  {filteredItems.map(item => {
                    const Icon = item.icon
                    const isActive = navSection === item.id

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setNavSection(item.id as NavSection)}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left font-medium transition-all cursor-pointer group',
                          isActive
                            ? 'bg-primary/15 text-primary font-bold shadow-2xs border border-primary/30'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
                        )}
                        title={item.label}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={cn('w-4 h-4 shrink-0 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                          {!sidebarCollapsed && (
                            <span className="truncate text-xs">{item.label}</span>
                          )}
                        </div>

                        {!sidebarCollapsed && (
                          <div className="flex items-center gap-1 shrink-0">
                            {item.dotColor && (
                              <span className={cn('w-1.5 h-1.5 rounded-full', item.dotColor)} />
                            )}
                            {item.badge && (
                              <span className={cn(
                                'text-[9px] font-bold px-1.5 py-0.5 rounded-md',
                                isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                              )}>
                                {item.badge}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Sidebar Footer (Live Balance Status) */}
        {!sidebarCollapsed && (
          <div className="p-3 border-t border-border bg-muted/20">
            <div className="p-2.5 rounded-2xl bg-card border border-border flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground block">Баланс автора (80%)</span>
                <span className="font-bold text-foreground text-sm">{authorStats.balance} ₽</span>
              </div>
              <button
                type="button"
                onClick={() => setNavSection('earnings')}
                className="px-2.5 py-1 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[11px] font-bold cursor-pointer transition-colors"
              >
                ЮMoney
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ── MAIN WORKSPACE CONTENT AREA ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top Control Bar */}
        <header className="h-16 border-b border-border bg-card/40 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <span className="text-muted-foreground capitalize">Студия</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-primary truncate">
                {navSection === 'manifest_builder' && 'Конструктор манифеста'}
                {navSection === 'universal_template' && 'Универсальный шаблон'}
                {navSection === 'import_export' && 'Импорт / Экспорт'}
                {navSection === 'live_sandbox' && 'Live Sandbox & Эмулятор'}
                {navSection === 'webhook_tester' && 'Webhook Tester'}
                {navSection === 'publish_github' && 'Публикация из GitHub'}
                {navSection === 'my_releases' && 'Мои плагины & Релизы'}
                {navSection === 'ai_prompts' && 'AI Промпты & Скиллы'}
                {navSection === 'ui_kit' && 'UI Kit & Темы оформления'}
                {navSection === 'inter_ai_protocol' && 'Двусторонний протокол'}
                {navSection === 'earnings' && 'Баланс автора & ЮMoney'}
                {navSection === 'sdk_docs' && 'Справочник SDK API'}
                {navSection === 'cli_tools' && 'Zerf CLI & Команды'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* GitHub Badge */}
            {userGh ? (
              <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-xs font-semibold flex items-center gap-1.5">
                <Check className="w-3 h-3" />
                <span>@{userGh}</span>
              </span>
            ) : (
              <a
                href="/settings"
                className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/25 text-xs font-semibold hover:bg-amber-500/20 transition-colors"
              >
                + Привязать GitHub
              </a>
            )}

            {/* YooMoney Bound Badge */}
            <span className="px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-300 border border-purple-500/25 text-xs font-semibold flex items-center gap-1.5">
              <CreditCard className="w-3 h-3" />
              <span>{boundCard?.cardNumber ? `ЮMoney: ${boundCard.cardNumber.slice(0, 5)}...` : 'ЮMoney 80%'}</span>
            </span>

            {/* Starter Kit Button */}
            <button
              onClick={handleDownloadStarterKit}
              className="hidden sm:flex px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Скачать Starter Kit</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl w-full mx-auto flex-1">

          {/* ══════════════════════════════════════════════════════════════
              VIEW 1: MANIFEST BUILDER & UNIVERSAL TEMPLATE
          ══════════════════════════════════════════════════════════════ */}
          {(navSection === 'manifest_builder' || navSection === 'universal_template' || navSection === 'import_export') && (
            <div className="space-y-6">
              {/* Top Banner */}
              <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-900/30 via-primary/15 to-transparent border border-primary/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <span>Визуальный конструктор манифеста zerf-extension.json</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Заполните параметры расширения, скопируйте сгенерированный манифест или загрузите универсальный шаблон
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleLoadUniversalTemplate}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Загрузить универсальный шаблон</span>
                  </button>
                </div>
              </div>

              {/* Two Column Builder */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* Form Controls */}
                <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-4">
                  <h3 className="font-bold text-sm flex items-center gap-2 border-b border-border pb-3">
                    <FolderPlus className="w-4 h-4 text-primary" />
                    <span>Параметры расширения</span>
                  </h3>

                  <div className="space-y-3.5 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-semibold text-foreground">Package ID (name)</label>
                        <input
                          type="text"
                          value={mName}
                          onChange={e => setMName(e.target.value)}
                          placeholder="zerf-plugin-research"
                          className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground font-mono outline-none focus:border-primary text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-foreground">Название (title)</label>
                        <input
                          type="text"
                          value={mTitle}
                          onChange={e => setMTitle(e.target.value)}
                          placeholder="Deep Research"
                          className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">Описание расширения</label>
                      <textarea
                        value={mDescription}
                        onChange={e => setMDescription(e.target.value)}
                        rows={2}
                        placeholder="Краткое описание функций..."
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
                        <label className="font-semibold text-foreground">Цена (₽)</label>
                        <input
                          type="number"
                          value={mPrice}
                          onChange={e => setMPrice(Number(e.target.value) || 0)}
                          placeholder="0 = Бесплатно"
                          className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground font-mono outline-none focus:border-primary text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">Инструкции для ИИ (AI Prompt Instructions)</label>
                      <textarea
                        value={mAiInstructions}
                        onChange={e => setMAiInstructions(e.target.value)}
                        rows={3}
                        placeholder="Опишите, как ИИ должен обрабатывать команды этого расширения..."
                        className="w-full p-2.5 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs resize-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">Триггерные фразы (через запятую)</label>
                      <input
                        type="text"
                        value={mTriggers}
                        onChange={e => setMTriggers(e.target.value)}
                        placeholder="/research, исследуй тему, найди факты"
                        className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">Webhook Endpoint (URL сервера)</label>
                      <input
                        type="text"
                        value={mEndpoint}
                        onChange={e => setMEndpoint(e.target.value)}
                        placeholder="https://api.domain.com/v1/zerf-hook"
                        className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground font-mono outline-none focus:border-primary text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Live JSON Preview */}
                <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-4 flex flex-col h-full">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-emerald-400" />
                      <span>zerf-extension.json</span>
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(manifestJsonString, 'json_manifest')}
                        className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedId === 'json_manifest' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === 'json_manifest' ? 'Скопировано!' : 'Копировать'}</span>
                      </button>

                      <button
                        onClick={handleDownloadStarterKit}
                        className="p-1.5 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary transition-colors cursor-pointer"
                        title="Скачать zerf-extension.json"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <pre className="flex-1 p-4 rounded-2xl bg-zinc-950 text-emerald-400 font-mono text-xs overflow-auto max-h-[500px] border border-border/60">
                    {manifestJsonString}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIEW 2: LIVE SANDBOX & CODE RUNNER
          ══════════════════════════════════════════════════════════════ */}
          {(navSection === 'live_sandbox' || navSection === 'webhook_tester') && (
            <div className="space-y-6">
              {/* Header */}
              <div className="p-5 rounded-3xl bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Play className="w-5 h-5 text-emerald-400" />
                    <span>Live Sandbox & Изолятор расширений (VM v2.6)</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Тестируйте логику расширения в реальном времени, с переключением тем Zerf, эмуляцией ZerfContext и логами исполнения
                  </p>
                </div>

                {/* Theme Selector for Sandbox */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5" /> Тема:
                  </span>
                  <select
                    value={sandboxTheme}
                    onChange={e => setSandboxTheme(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-muted border border-border text-xs font-semibold text-foreground outline-none cursor-pointer"
                  >
                    {THEME_OPTIONS.map(th => (
                      <option key={th.id} value={th.id}>{th.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Command Bar */}
              <div className="p-4 rounded-2xl bg-card border border-border flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  ⚡
                </div>
                <input
                  type="text"
                  value={sandboxCommand}
                  onChange={e => setSandboxCommand(e.target.value)}
                  placeholder="Введите команду расширения (например: /research тренды 2026)..."
                  className="flex-1 bg-transparent text-xs text-foreground outline-none font-mono"
                  onKeyDown={e => e.key === 'Enter' && handleRunSandbox()}
                />
                <button
                  onClick={handleRunSandbox}
                  disabled={sandboxRunning}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {sandboxRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{sandboxRunning ? 'Исполнение...' : 'Запустить тест'}</span>
                </button>
              </div>

              {/* Two Column Sandbox Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* Left: Code Editor */}
                <div className="p-5 rounded-3xl bg-card border border-border shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="font-bold text-xs flex items-center gap-2 text-foreground">
                      <Code2 className="w-4 h-4 text-primary" />
                      <span>Код расширения (widget.js / handler.ts)</span>
                    </h3>
                    <span className="text-[10px] text-emerald-400 font-mono">ZerfContext injected</span>
                  </div>

                  <textarea
                    value={sandboxCode}
                    onChange={e => setSandboxCode(e.target.value)}
                    rows={16}
                    className="w-full p-4 rounded-2xl bg-zinc-950 text-emerald-400 font-mono text-xs outline-none border border-border/60 resize-none leading-relaxed"
                  />
                </div>

                {/* Right: Live Frame Simulation with Theme */}
                <div className="space-y-4">
                  {/* Themed Preview Box */}
                  <div className={cn(
                    'p-5 rounded-3xl border shadow-lg transition-all duration-300 space-y-4',
                    THEME_OPTIONS.find(t => t.id === sandboxTheme)?.bg || 'bg-card',
                    THEME_OPTIONS.find(t => t.id === sandboxTheme)?.text || 'text-foreground',
                    THEME_OPTIONS.find(t => t.id === sandboxTheme)?.border || 'border-border'
                  )}>
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{mIcon}</span>
                        <span className="font-bold text-xs">{mTitle} (Виджет в UI)</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                        {sandboxTheme.toUpperCase()}
                      </span>
                    </div>

                    {/* Output Message */}
                    {sandboxOutput && (
                      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
                        <p className="font-semibold text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{sandboxOutput.responseMessage}</span>
                        </p>
                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1 border-t border-white/10">
                          <span>Latency: <b>{sandboxOutput.latencyMs} ms</b></span>
                          <span>HTTP: <b>{sandboxOutput.status} OK</b></span>
                        </div>
                      </div>
                    )}

                    {/* Mock Tasks created in Sandbox */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Задачи в рабочем пространстве:
                      </p>
                      <div className="space-y-1.5">
                        {sandboxTasks.slice(0, 3).map(t => (
                          <div key={t.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                            <span className={cn('truncate', t.done && 'line-through opacity-60')}>{t.title}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">{t.priority}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Sandbox Console Logs */}
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-border/80 text-xs font-mono space-y-2 max-h-[220px] overflow-y-auto">
                    <div className="flex items-center justify-between text-muted-foreground text-[10px] border-b border-border/40 pb-1">
                      <span>Live Execution Console</span>
                      <button onClick={() => setSandboxLogs([])} className="hover:text-foreground">Очистить</button>
                    </div>
                    {sandboxLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-2 text-[11px] leading-relaxed">
                        <span className="text-zinc-500">[{log.time}]</span>
                        <span className={cn(
                          log.type === 'success' && 'text-emerald-400',
                          log.type === 'warn' && 'text-amber-400',
                          log.type === 'rpc' && 'text-purple-400',
                          log.type === 'info' && 'text-zinc-300'
                        )}>
                          {log.msg}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIEW 3: STRICT GITHUB PUBLISH & VALIDATION
          ══════════════════════════════════════════════════════════════ */}
          {navSection === 'publish_github' && (
            <div className="space-y-6 max-w-4xl">
              <div className="p-6 rounded-3xl bg-card border border-border space-y-4">
                <div className="border-b border-border pb-4">
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" />
                    <span>Публикация расширения из GitHub репозитория</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Система строго проверяет привязку вашего GitHub-аккаунта и валидирует схему манифеста в корне репозитория
                  </p>
                </div>

                {/* GitHub Account Status Alert */}
                <div className={cn(
                  'p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs',
                  userGh
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                )}>
                  <div className="flex items-center gap-2.5">
                    {userGh ? <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
                    <div>
                      <p className="font-bold">
                        {userGh ? `Привязан GitHub аккаунт: @${userGh}` : 'GitHub аккаунт не привязан!'}
                      </p>
                      <p className="text-[11px] opacity-80 mt-0.5">
                        {userGh
                          ? 'Все публикуемые вами репозитории должны принадлежать этому пользователю.'
                          : 'Для защиты авторства расширений требуется привязать аккаунт в Настройках.'}
                      </p>
                    </div>
                  </div>

                  {!userGh && (
                    <a
                      href="/settings"
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs shrink-0 cursor-pointer shadow-xs"
                    >
                      Привязать в Настройках
                    </a>
                  )}
                </div>

                {/* Input Repo URL */}
                <div className="space-y-2 pt-2">
                  <label className="font-semibold text-foreground text-xs block">
                    Ссылка на публичный репозиторий GitHub:
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={publishRepoUrl}
                      onChange={e => setPublishRepoUrl(e.target.value)}
                      placeholder="https://github.com/waters1ze/zerf-deep-research"
                      className="flex-1 h-10 px-3.5 rounded-xl bg-muted/40 border border-border text-xs text-foreground font-mono outline-none focus:border-primary"
                    />
                    <button
                      onClick={handleValidateGithubRepo}
                      disabled={publishValidating || !publishRepoUrl.trim()}
                      className="h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {publishValidating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      <span>Проверить и спарсить</span>
                    </button>
                  </div>
                </div>

                {/* Validation Result Box */}
                {publishValidation && (
                  <div className={cn(
                    'p-5 rounded-2xl border space-y-3 text-xs',
                    publishValidation.valid
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-rose-500/10 border-rose-500/30'
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5">
                        {publishValidation.valid ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                        <span className={publishValidation.valid ? 'text-emerald-300' : 'text-rose-300'}>
                          {publishValidation.valid ? 'Валидация успешно пройдена!' : 'Ошибки при проверке репозитория'}
                        </span>
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        github.com/{publishValidation.owner}/{publishValidation.repo}
                      </span>
                    </div>

                    {/* Owner check message */}
                    <div className="p-3 rounded-xl bg-black/20 text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span>Проверка владельца (@{publishValidation.owner}):</span>
                        <b className={publishValidation.ownerMatches ? 'text-emerald-400' : 'text-rose-400'}>
                          {publishValidation.ownerMatches ? '✓ Совпадает с вашим профилем' : '✕ Не совпадает с профилем'}
                        </b>
                      </div>
                      <div className="flex justify-between">
                        <span>Наличие zerf-extension.json:</span>
                        <b className={publishValidation.manifestFound ? 'text-emerald-400' : 'text-rose-400'}>
                          {publishValidation.manifestFound ? '✓ Найден' : '✕ Не найден'}
                        </b>
                      </div>
                    </div>

                    {/* Errors list */}
                    {publishValidation.errors.length > 0 && (
                      <div className="space-y-1 text-rose-300 text-[11px]">
                        {publishValidation.errors.map((err, i) => (
                          <p key={i}>• {err}</p>
                        ))}
                      </div>
                    )}

                    {/* Publish Button if valid */}
                    {publishValidation.valid && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={handlePublishNow}
                          disabled={loading}
                          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
                        >
                          <Globe className="w-4 h-4" />
                          <span>Опубликовать в Магазин Zerf Note</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIEW 4: AI PROMPTS, SKILLS & RULES LIBRARY
          ══════════════════════════════════════════════════════════════ */}
          {navSection === 'ai_prompts' && (
            <div className="space-y-6 max-w-5xl">
              <div className="p-6 rounded-3xl bg-card border border-border space-y-4">
                <div className="border-b border-border pb-4">
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <Bot className="w-5 h-5 text-purple-400" />
                    <span>Библиотека AI-скиллов и системных промптов (Cursor / GPT / Claude)</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Скопируйте готовые инструкции в ваши AI-ассистенты для автоматической генерации плагинов в фирменном стиле Zerf Note
                  </p>
                </div>

                {/* Tab selector */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border/40 text-xs">
                  {[
                    { id: 'cursor_skill', label: '🔮 Cursor / Windsurf Skill' },
                    { id: 'theme_styler', label: '🎨 UI & Theme Styler Guide' },
                    { id: 'action_protocol', label: '🔄 Inter-AI Action Protocol' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActivePromptTab(tab.id as any)}
                      className={cn(
                        'px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer shrink-0',
                        activePromptTab === tab.id
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Prompt Viewer */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground">
                      {activePromptTab === 'cursor_skill' && 'Промпт для Cursor IDE / Windsurf (.cursorrules):'}
                      {activePromptTab === 'theme_styler' && 'Инструкция по верстке с поддержкой тем Zerf Note:'}
                      {activePromptTab === 'action_protocol' && 'Спецификация ответа внешней нейросети (Inter-AI Protocol):'}
                    </p>

                    <button
                      onClick={() => {
                        const content = activePromptTab === 'cursor_skill'
                          ? CURSOR_AI_SKILL
                          : activePromptTab === 'theme_styler'
                          ? THEME_STYLER_PROMPT
                          : ACTION_PROTOCOL_PROMPT
                        copyToClipboard(content, 'prompt_copy')
                      }}
                      className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedId === 'prompt_copy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === 'prompt_copy' ? 'Скопировано!' : 'Копировать промпт'}</span>
                    </button>
                  </div>

                  <pre className="p-4 rounded-2xl bg-zinc-950 text-purple-300 font-mono text-xs overflow-auto max-h-[400px] border border-border/60 leading-relaxed whitespace-pre-wrap">
                    {activePromptTab === 'cursor_skill' && CURSOR_AI_SKILL}
                    {activePromptTab === 'theme_styler' && THEME_STYLER_PROMPT}
                    {activePromptTab === 'action_protocol' && ACTION_PROTOCOL_PROMPT}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIEW 5: AUTHOR EARNINGS & YOOMONEY (80/20)
          ══════════════════════════════════════════════════════════════ */}
          {navSection === 'earnings' && (
            <div className="space-y-6 max-w-4xl">
              {/* Stats Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-3xl bg-card border border-border shadow-xs space-y-1">
                  <p className="text-xs text-muted-foreground font-semibold flex items-center justify-between">
                    <span>Баланс автора (80%)</span>
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </p>
                  <p className="text-3xl font-black text-emerald-400">{authorStats.balance} ₽</p>
                  <p className="text-[10px] text-muted-foreground">автоматические выплаты на ЮMoney</p>
                </div>

                <div className="p-5 rounded-3xl bg-card border border-border shadow-xs space-y-1">
                  <p className="text-xs text-muted-foreground font-semibold flex items-center justify-between">
                    <span>Всего заработано</span>
                    <Activity className="w-4 h-4 text-purple-400" />
                  </p>
                  <p className="text-3xl font-black text-foreground">{authorStats.totalEarned} ₽</p>
                  <p className="text-[10px] text-muted-foreground">за всё время продаж</p>
                </div>

                <div className="p-5 rounded-3xl bg-card border border-border shadow-xs space-y-1">
                  <p className="text-xs text-muted-foreground font-semibold flex items-center justify-between">
                    <span>Количество продаж</span>
                    <Package className="w-4 h-4 text-primary" />
                  </p>
                  <p className="text-3xl font-black text-foreground">{authorStats.salesCount}</p>
                  <p className="text-[10px] text-muted-foreground">успешных покупок плагинов</p>
                </div>
              </div>

              {/* YooMoney Binding Card */}
              <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-purple-400" />
                      <span>Привязка ЮMoney для автоматических выплат (80/20)</span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      80% с каждой продажи ваших плагинов начисляются вам автоматически на привязанный кошелёк
                    </p>
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                    Авто-режим
                  </span>
                </div>

                {boundCard ? (
                  <div className="p-4 rounded-2xl bg-muted/40 border border-purple-500/30 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-foreground flex items-center gap-2">
                        <span>{boundCard.payoutType === 'yoomoney' ? '🟣 ЮMoney кошелёк' : '💳 Банковская карта'}</span>
                        <span className="text-emerald-400 text-[10px]">✓ Активен для зачислений</span>
                      </p>
                      <p className="text-muted-foreground font-mono text-xs mt-0.5">
                        {boundCard.payoutType === 'yoomoney' ? boundCard.cardNumber : `•••• ${boundCard.cardNumber?.slice(-4)} (${boundCard.bankName || ''})`}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDevYoomoneyModal(!showDevYoomoneyModal)}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 font-bold text-xs cursor-pointer transition-colors"
                    >
                      Изменить реквизиты
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                    <p className="text-xs text-amber-300 font-medium">
                      Укажите ваш кошелёк ЮMoney, чтобы получать 80% от продаж расширений.
                    </p>
                    <button
                      onClick={() => setShowDevYoomoneyModal(true)}
                      className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Привязать ЮMoney (80%)</span>
                    </button>
                  </div>
                )}

                {/* Inline YooMoney Form */}
                {showDevYoomoneyModal && (
                  <form onSubmit={handleSaveDevPayoutDetails} className="p-5 rounded-2xl bg-muted/50 border border-purple-500/40 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-xs text-foreground">Привязка реквизитов для зачисления 80% дохода:</p>
                      <button type="button" onClick={() => setShowDevYoomoneyModal(false)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDevCardPayoutType('yoomoney')}
                        className={cn(
                          'flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center',
                          devCardPayoutType === 'yoomoney' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-xs' : 'bg-card text-muted-foreground border-border'
                        )}
                      >
                        🟣 ЮMoney кошелёк
                      </button>
                      <button
                        type="button"
                        onClick={() => setDevCardPayoutType('card')}
                        className={cn(
                          'flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center',
                          devCardPayoutType === 'card' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-xs' : 'bg-card text-muted-foreground border-border'
                        )}
                      >
                        💳 Карта РФ
                      </button>
                    </div>

                    {devCardPayoutType === 'yoomoney' ? (
                      <div className="space-y-1">
                        <label className="text-[11px] text-muted-foreground block">Номер счёта ЮMoney (14–16 цифр: 41001...):</label>
                        <input
                          type="text"
                          required
                          value={devCardNumber}
                          onChange={e => setDevCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                          placeholder="4100119573095433"
                          className="w-full h-9 px-3 rounded-xl bg-card border border-border text-xs text-foreground font-mono outline-none focus:border-purple-500"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] text-muted-foreground block">Номер карты РФ:</label>
                          <input
                            type="text"
                            required
                            value={devCardNumber}
                            onChange={e => setDevCardNumber(e.target.value.replace(/\D/g, '').slice(0, 19))}
                            placeholder="2200 0000 0000 0000"
                            className="w-full h-9 px-3 rounded-xl bg-card border border-border text-xs text-foreground font-mono outline-none focus:border-purple-500"
                          />
                        </div>
                        <div className="space-y-1 relative">
                          <label className="text-[11px] text-muted-foreground block">Банк карты:</label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowDevBankDropdown(!showDevBankDropdown)}
                              className="w-full h-9 px-3 rounded-xl bg-card border border-border text-xs text-foreground flex items-center justify-between gap-1.5 hover:border-purple-500 transition-colors cursor-pointer"
                            >
                              <span className="truncate font-medium">
                                {devCardBank
                                  ? (POPULAR_BANKS_LIST.find(b => b.name === devCardBank)?.icon || '💳') + ' ' + devCardBank
                                  : 'Выбрать банк...'}
                              </span>
                              <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", showDevBankDropdown && "rotate-180")} />
                            </button>

                            <AnimatePresence>
                              {showDevBankDropdown && (
                                <motion.div
                                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                  className="absolute right-0 top-full mt-1.5 w-60 p-1.5 rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl z-50 space-y-0.5 max-h-56 overflow-y-auto"
                                >
                                  {POPULAR_BANKS_LIST.map(b => (
                                    <button
                                      key={b.name}
                                      type="button"
                                      onClick={() => {
                                        setDevCardBank(b.name)
                                        setShowDevBankDropdown(false)
                                      }}
                                      className={cn(
                                        "w-full px-2.5 py-1.5 rounded-xl text-left text-xs flex items-center justify-between transition-colors cursor-pointer",
                                        devCardBank === b.name
                                          ? "bg-purple-500/20 text-purple-300 font-bold"
                                          : "text-foreground hover:bg-muted/70"
                                      )}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm">{b.icon}</span>
                                        <span>{b.name}</span>
                                      </div>
                                      <span className="text-[9px] text-muted-foreground font-mono">{b.badge}</span>
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={payoutLoading}
                        className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {payoutLoading ? 'Сохранение...' : 'Сохранить реквизиты'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDevYoomoneyModal(false)}
                        className="px-3.5 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-semibold cursor-pointer"
                      >
                        Отмена
                      </button>
                    </div>
                  </form>
                )}

                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-emerald-400">⚡ 100% Автоматические выплаты</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Средства с каждой продажи моментально зачисляются на ваш баланс и выплачиваются на ЮMoney. Ручные запросы не требуются.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/30 shrink-0">
                    80% доход
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIEW 6: MY RELEASES & PLUGINS LIST
          ══════════════════════════════════════════════════════════════ */}
          {navSection === 'my_releases' && (
            <div className="space-y-6 max-w-4xl">
              <div className="p-6 rounded-3xl bg-card border border-border space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <h2 className="text-base font-bold flex items-center gap-2">
                      <Package className="w-5 h-5 text-primary" />
                      <span>Мои расширения & Релизы</span>
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Управление версиями, ценами, описанием и статусом в каталоге
                    </p>
                  </div>

                  <button
                    onClick={() => setNavSection('publish_github')}
                    className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>+ Опубликовать расширение</span>
                  </button>
                </div>

                {myExtensions.length > 0 ? (
                  <div className="space-y-3">
                    {myExtensions.map(ext => (
                      <div key={ext.id} className="p-4 rounded-2xl bg-muted/40 border border-border flex items-center justify-between gap-4 text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center text-xl shrink-0">
                            {ext.icon || '🧩'}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-foreground truncate flex items-center gap-2">
                              <span>{ext.title}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">v{ext.version || '1.0.0'}</span>
                            </h4>
                            <p className="text-[11px] text-muted-foreground truncate">{ext.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-bold text-emerald-400">
                            {ext.price > 0 ? `${ext.price} ₽` : 'Бесплатно'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                            Опубликован
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-muted/20 border border-dashed border-border text-center space-y-2">
                    <p className="font-bold text-foreground text-sm">У вас пока нет опубликованных расширений</p>
                    <p className="text-xs text-muted-foreground">
                      Создайте манифест в Конструкторе или опубликуйте готовый репозиторий из GitHub
                    </p>
                    <button
                      onClick={() => setNavSection('publish_github')}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs mt-2 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Опубликовать из GitHub</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIEW 7: SDK DOCS & CLI TOOLS
          ══════════════════════════════════════════════════════════════ */}
          {(navSection === 'sdk_docs' || navSection === 'cli_tools') && (
            <div className="space-y-6 max-w-5xl">
              <div className="p-6 md:p-8 rounded-3xl bg-card border border-border shadow-xs space-y-6 text-xs">
                <div className="border-b border-border pb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-primary" />
                      <span>Полный справочник разработчика Zerf Note SDK</span>
                    </h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      API контекста, права доступа, Webhook обработчики и CLI-инструменты
                    </p>
                  </div>

                  <button
                    onClick={handleDownloadStarterKit}
                    className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Скачать Starter Kit</span>
                  </button>
                </div>

                <div className="space-y-4 text-xs leading-relaxed text-foreground/90">
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
                    <p className="font-bold text-foreground">📦 Установка SDK через npm:</p>
                    <pre className="p-3 rounded-xl bg-zinc-950 text-emerald-400 font-mono text-xs overflow-x-auto">
npm install @zerf/sdk
# или через bun / pnpm:
pnpm add @zerf/sdk</pre>
                  </div>

                  <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
                    <p className="font-bold text-foreground">💻 Команды Zerf CLI:</p>
                    <pre className="p-3 rounded-xl bg-zinc-950 text-primary font-mono text-xs overflow-x-auto">
{`# Авторизация по токену:
npx zerf-cli auth --token YOUR_SECRET_TOKEN

# Создание нового расширения по шаблону:
npx zerf-cli extension init my-cool-widget

# Локальный запуск и тестирование в песочнице:
npx zerf-cli extension test ./my-cool-widget

# Публикация в Магазин Zerf Note:
npx zerf-cli extension publish ./my-cool-widget`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIEW 8: UI KIT & DESIGN SYSTEM
          ══════════════════════════════════════════════════════════════ */}
          {navSection === 'ui_kit' && (
            <div className="space-y-6 max-w-5xl">
              <div className="p-6 rounded-3xl bg-card border border-border space-y-4">
                <div className="border-b border-border pb-4">
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <Palette className="w-5 h-5 text-pink-400" />
                    <span>Zerf UI Kit & Дизайн-система</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Используйте фирменные CSS-токены, эффекты Glassmorphism и адаптивные компоненты для идеальной интеграции плагина
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-2">
                    <span className="font-bold block">Glassmorphism Card</span>
                    <p className="text-muted-foreground text-[11px]">Классы: <code className="text-primary font-mono">bg-card border border-border shadow-xs rounded-2xl</code></p>
                  </div>

                  <div className="p-4 rounded-2xl bg-primary text-primary-foreground shadow-md space-y-2 flex flex-col justify-between">
                    <span className="font-bold block">Primary Action Button</span>
                    <p className="text-[11px] opacity-90 font-mono">bg-primary text-primary-foreground</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-300 space-y-2">
                    <span className="font-bold block">AI / Accent Badge</span>
                    <p className="text-[11px] opacity-80 font-mono">bg-purple-500/15 text-purple-300</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIEW 9: INTER-AI PROTOCOL & ARCHITECTURE
          ══════════════════════════════════════════════════════════════ */}
          {navSection === 'inter_ai_protocol' && (
            <div className="space-y-6 max-w-5xl">
              <div className="p-6 rounded-3xl bg-card border border-border space-y-4">
                <div className="border-b border-border pb-4">
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <Workflow className="w-5 h-5 text-cyan-400" />
                    <span>Двусторонний протокол взаимопонимания нейросетей (Inter-AI Handshake)</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Архитектура взаимодействия встроенного ИИ Zerf Note и внешних нейросетей пользователя (OpenAI, Claude, DeepSeek, Ollama)
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground text-sm flex items-center gap-2">
                      <span>📥 Входящий контекст (В вашу модель)</span>
                    </span>
                    <p className="text-muted-foreground leading-relaxed text-[11px]">
                      Zerf Note автоматически обогащает запрос к вашей кастомной модели полной матрицей контекста пользователя: активные задачи, цели, события календаря и системные инструкции расширения.
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-2">
                    <span className="font-bold text-foreground text-sm flex items-center gap-2">
                      <span>📤 Нормализованный Action Protocol</span>
                    </span>
                    <p className="text-muted-foreground leading-relaxed text-[11px]">
                      Ваша нейросеть возвращает стандартизированные экшены (<code className="text-primary">create_task</code>, <code className="text-primary">create_note</code>). Внутренний ИИ и маскот Зерфик мгновенно распознают их и применяют к базе данных.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
