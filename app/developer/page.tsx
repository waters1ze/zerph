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

export function GithubIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

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
  const [mAuthor, setMAuthor] = useState('')
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
  const [userRepos, setUserRepos] = useState<Array<{
    name: string
    fullName: string
    description: string
    htmlUrl: string
    isPrivate: boolean
    stars: number
    forks: number
    language: string
    updatedAt: string
    defaultBranch: string
  }>>([])
  const [loadingUserRepos, setLoadingUserRepos] = useState(false)
  const [repoSearchFilter, setRepoSearchFilter] = useState('')
  const [repoTypeFilter, setRepoTypeFilter] = useState<'all' | 'public' | 'private'>('all')
  const [publishMode, setPublishMode] = useState<'picker' | 'manual'>('picker')
  const [showPatInput, setShowPatInput] = useState(false)
  const [customPatToken, setCustomPatToken] = useState('')
  const [savingPat, setSavingPat] = useState(false)
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

  const handleSavePat = async () => {
    if (!customPatToken.trim()) return
    setSavingPat(true)
    try {
      localStorage.setItem('zerf_github_token', customPatToken.trim())
      await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_github_token', token: customPatToken.trim() }),
      })
      alert('✓ Токен GitHub сохранён! Загрузка приватных репозиториев...')
      setShowPatInput(false)
      fetchUserRepos(userGh || undefined, customPatToken.trim())
    } catch {
      alert('Ошибка сохранения токена')
    } finally {
      setSavingPat(false)
    }
  }

  // Fetch Repositories from GitHub
  const fetchUserRepos = async (usernameOverride?: string, tokenOverride?: string) => {
    const target = (usernameOverride || userGh || '').trim().replace(/^@/, '')
    if (!target) return
    const token = tokenOverride || (typeof window !== 'undefined' ? (localStorage.getItem('zerf_github_token') || '') : '')
    setLoadingUserRepos(true)
    try {
      const url = `/api/extensions?action=user_repos&username=${encodeURIComponent(target)}${token ? `&token=${encodeURIComponent(token)}` : ''}`
      const res = await fetch(url, {
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success && Array.isArray(data.repos)) {
        setUserRepos(data.repos)
      }
    } catch {} finally {
      setLoadingUserRepos(false)
    }
  }

  // AI Prompts Section State
  const [activePromptTab, setActivePromptTab] = useState<'cursor_skill' | 'theme_styler' | 'action_protocol'>('cursor_skill')
  const [selectedPromptCategory, setSelectedPromptCategory] = useState<string>('all')
  const [searchPromptQuery, setSearchPromptQuery] = useState<string>('')
  const [selectedPromptId, setSelectedPromptId] = useState<string>('cursor_skill')

  // SDK Docs Section State
  const [sdkDocTab, setSdkDocTab] = useState<'overview' | 'manifest' | 'context' | 'github_publish' | 'monetization'>('overview')

  // Universal Templates Catalog State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('ai_research')
  const [templateCodeTab, setTemplateCodeTab] = useState<'manifest' | 'code' | 'readme'>('manifest')

  // Import / Export JSON State
  const [importJsonText, setImportJsonText] = useState<string>('')
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; errors: string[]; parsed: any | null } | null>(null)

  // Webhook & REST Tester State
  const [whMethod, setWhMethod] = useState<'POST' | 'GET' | 'PUT' | 'DELETE'>('POST')
  const [whUrl, setWhUrl] = useState<string>('/api/extensions')
  const [whPreset, setWhPreset] = useState<string>('task_created')
  const [whHeaders, setWhHeaders] = useState<string>(JSON.stringify({ 'Content-Type': 'application/json', 'X-Zerf-Source': 'developer_hub' }, null, 2))
  const [whBody, setWhBody] = useState<string>(JSON.stringify({
    event: 'task.created',
    timestamp: new Date().toISOString(),
    task: { id: 'task_demo_101', title: 'Подготовить релиз плагина', priority: 'high', dueDate: '2026-08-22' }
  }, null, 2))
  const [whResponse, setWhResponse] = useState<{ status: number; statusText: string; timeMs: number; headers: Record<string, string>; body: string } | null>(null)
  const [whLoading, setWhLoading] = useState(false)

  // Zerf CLI Terminal State
  const [cliCommandInput, setCliCommandInput] = useState<string>('')
  const [cliLogs, setCliLogs] = useState<Array<{ id: string; command: string; output: string; time: string; status: 'ok' | 'err' | 'info' }>>([
    { id: '1', command: 'zerf --version', output: 'zerf-cli v2.6.0 (x64-node20) - Official Zerf Note Command Line', time: '18:10:00', status: 'ok' },
    { id: '2', command: 'zerf login', output: '✓ Успешная авторизация разработчика: @waters1ze (Developer Token Active)', time: '18:10:05', status: 'ok' },
  ])

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
        if (data.githubUsername) {
          const cleanGh = data.githubUsername.replace(/^@/, '').trim()
          setUserGh(cleanGh)
          setMAuthor(cleanGh)
          try {
            localStorage.setItem('zerf_github_username', cleanGh)
            localStorage.setItem('zerf_user_github', cleanGh)
          } catch {}
          fetchUserRepos(cleanGh)
        }
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
      const gh = (
        localStorage.getItem('zerf_github_username') ||
        localStorage.getItem('zerf_user_github') ||
        ''
      ).replace(/^@/, '').trim()
      if (gh) {
        setUserGh(gh)
        setMAuthor(gh)
        fetchUserRepos(gh)
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
  const handleValidateGithubRepo = async (overrideUrl?: string) => {
    const raw = (overrideUrl || publishRepoUrl || '').trim()
    if (!raw) {
      alert('Введите ссылку на GitHub репозиторий или выберите проект из списка')
      return
    }
    if (overrideUrl) setPublishRepoUrl(overrideUrl)
    setPublishValidating(true)
    setPublishValidation(null)

    try {
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate_github_repo',
          repoUrl: raw,
        }),
      })
      const data = await res.json()
      if (data.success && data.validation) {
        setPublishValidation(data.validation)
        if (data.validation.manifest) {
          const m = data.validation.manifest
          if (m.name) setMName(m.name)
          if (m.title) setMTitle(m.title)
          if (m.description) setMDescription(m.description)
          if (m.category) setMCategory(m.category)
          if (m.type) setMType(m.type)
          if (m.icon) setMIcon(m.icon)
          if (m.price !== undefined) setMPrice(m.price)
        }
      } else {
        setPublishValidation({
          tested: true,
          valid: false,
          owner: 'unknown',
          repo: 'unknown',
          ownerMatches: false,
          manifestFound: false,
          errors: [data.error || 'Ошибка проверки репозитория на GitHub'],
        })
      }
    } catch (err: any) {
      setPublishValidation({
        tested: true,
        valid: false,
        owner: 'unknown',
        repo: 'unknown',
        ownerMatches: false,
        manifestFound: false,
        errors: ['Сетевая ошибка при обращении к серверу проверки'],
      })
    } finally {
      setPublishValidating(false)
    }
  }

  // Handle Publishing Extension
  const handlePublishNow = async () => {
    if (!publishValidation?.valid) return
    setLoading(true)
    try {
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'publish_from_github',
          repoUrl: publishRepoUrl.trim(),
          manifest: publishValidation.manifest,
        }),
      })
      const data = await res.json()
      if (data.success) {
        alert('🎉 Расширение успешно опубликовано в Каталог Zerf!')
        setNavSection('my_releases')
        fetchDevData()
      } else {
        alert('Ошибка публикации: ' + (data.error || 'Неизвестная ошибка'))
      }
    } catch {
      alert('Сетевая ошибка при публикации')
    } finally {
      setLoading(false)
    }
  }

  // Universal Template Loader
  const handleLoadUniversalTemplate = () => {
    setMName('zerf-plugin-productivity-hub')
    setMTitle('Productivity Master Hub')
    setMVersion('1.0.0')
    setMDescription('Универсальный виджет с поддержкой фокус-таймера, глубокого поиска, заметок и ИИ команд.')
    setMCategory('Продуктивность')
    setMType('widget')
    setMIcon('⚡')
    setMPrice(0)
    setMMinPlan('free')
    setMIsRunnable(true)
    setMAiInstructions('Анализируй цели пользователя, предлагай декомпозицию задач и логируй интервалы таймера.')
    setMTriggers('/focus, /task, /decompose, помидор')
    setMEndpoint('https://api.yourdomain.com/v1/zerf-webhook')
    setNavSection('manifest_builder')
  }

  // Download Starter Kit JSON
  const handleDownloadStarterKit = () => {
    const starterKitJson = {
      $schema: 'https://zeprh.vercel.app/schemas/extension-v2.json',
      name: mName,
      title: mTitle,
      version: mVersion,
      description: mDescription,
      category: mCategory,
      type: mType,
      icon: mIcon,
      author: mAuthor || userGh || 'developer',
      price: mPrice,
      minPlan: mMinPlan,
      permissions: ['tasks:read', 'tasks:write', 'notes:write', 'ui:notify', 'ai:prompt'],
      triggers: mTriggers.split(',').map(s => s.trim()).filter(Boolean),
      aiInstructions: mAiInstructions,
      endpoint: mEndpoint,
    }
    const blob = new Blob([JSON.stringify(starterKitJson, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'zerf-extension.json'
    a.click()
  }

  // Sandbox Live Execution Runner
  const handleRunSandbox = async () => {
    setSandboxRunning(true)
    const newLogId = String(Date.now())
    const timeStr = new Date().toLocaleTimeString('ru-RU')

    setSandboxLogs(prev => [
      ...prev,
      { id: newLogId, time: timeStr, type: 'rpc', msg: `[IPC] Отправка команды "${sandboxCommand}" в песочницу...` }
    ])

    setTimeout(() => {
      const now = new Date().toLocaleTimeString('ru-RU')
      const newTaskTitle = 'Задача из команды: ' + (sandboxCommand || 'Тест')
      const newNoteTitle = 'Заметка: ' + (sandboxCommand || 'Тестовый отчет')

      setSandboxTasks(prev => [
        { id: 't-' + Date.now(), title: newTaskTitle, priority: 'high', done: false },
        ...prev
      ])

      setSandboxNotes(prev => [
        { id: 'n-' + Date.now(), title: newNoteTitle, body: 'Результат выполнения команды: ' + sandboxCommand },
        ...prev
      ])

      setSandboxOutput({
        status: 200,
        latencyMs: Math.floor(Math.random() * 25) + 20,
        responseMessage: `✓ Команда успешно обработана. Созданы задача и заметка в изолированном контексте.`,
        createdTasks: [newTaskTitle],
        createdNotes: [newNoteTitle]
      })

      setSandboxLogs(prev => [
        ...prev,
        { id: String(Date.now()), time: now, type: 'success', msg: `✓ Вызов ZerfContext.tasks.create() -> ID t-${Date.now()}` },
        { id: String(Date.now() + 1), time: now, type: 'success', msg: `✓ Вызов ZerfContext.notes.create() -> ID n-${Date.now()}` },
        { id: String(Date.now() + 2), time: now, type: 'info', msg: `⚡ Изолятор VM завершил выполнение за 38ms (0 утечек памяти).` },
      ])

      setSandboxRunning(false)
    }, 600)
  }

  // Generated JSON string
  const manifestJsonString = JSON.stringify(
    {
      $schema: 'https://zeprh.vercel.app/schemas/extension-v2.json',
      name: mName,
      title: mTitle,
      version: mVersion,
      description: mDescription,
      category: mCategory,
      type: mType,
      icon: mIcon,
      author: mAuthor || userGh || 'developer',
      price: mPrice,
      minPlan: mMinPlan,
      isRunnable: mIsRunnable,
      permissions: ['tasks:read', 'tasks:write', 'notes:write', 'ui:notify', 'ai:prompt'],
      triggers: mTriggers.split(',').map(s => s.trim()).filter(Boolean),
      aiInstructions: mAiInstructions,
      endpoint: mEndpoint,
    },
    null,
    2
  )

  // AI Prompts and Skills Collection
  interface AiPromptItem {
    id: string
    category: 'cursor' | 'copilot' | 'chatgpt' | 'system_ide'
    title: string
    shortDesc: string
    icon: string
    badge: string
    tags: string[]
    prompt: string
    suggestedManifest?: {
      name: string
      title: string
      category: string
      type: 'widget' | 'template' | 'theme' | 'integration' | 'prompt'
      icon: string
      description: string
      triggers: string
      aiInstructions: string
    }
    suggestedSandboxCode?: string
  }

  const AI_PROMPTS_COLLECTION: AiPromptItem[] = [
    {
      id: 'cursor_skill',
      category: 'cursor',
      title: 'Системный Cursor Skill для расширений Zerf',
      shortDesc: 'Официальный системный промпт для Cursor AI (.cursorrules). Обучает ИИ писать манифесты, виджеты и интеграции Zerf Note.',
      icon: '⚡',
      badge: 'Cursor Rules',
      tags: ['Cursor', '.cursorrules', 'Typescript', 'Tailwind', 'ZerfContext'],
      prompt: `You are an expert developer building extensions, widgets, and themes for the Zerf Note platform (https://zeprh.vercel.app).
When building a Zerf extension:
1. Always adhere to the Manifest V2 specification (zerf-extension.json).
2. Utilize the ZerfContext API for tasks, notes, user preferences, and AI prompts.
3. Design widgets using Tailwind CSS with glassmorphism styling (bg-card/80 border border-border/80 rounded-2xl).
4. Implement strict error handling and notify users via ZerfContext.notifications.send.`
    },
    {
      id: 'theme_styler',
      category: 'system_ide',
      title: 'Генератор CSS тем & Glassmorphism',
      shortDesc: 'Промпт для генерации адаптивных CSS тем и неоновых эффектов, совместимых с Zerf UI Kit.',
      icon: '🎨',
      badge: 'Theme Styler',
      tags: ['CSS Variables', 'Themes', 'Tailwind', 'Glassmorphism'],
      prompt: `Create a custom CSS theme for Zerf Note adhering to the CSS token specification:
:root[data-theme="custom-name"] {
  --background: 240 10% 4%;
  --foreground: 0 0% 98%;
  --card: 240 10% 6%;
  --card-foreground: 0 0% 98%;
  --primary: 263 70% 58%;
  --primary-foreground: 0 0% 100%;
  --border: 240 6% 15%;
}`
    },
    {
      id: 'action_protocol',
      category: 'system_ide',
      title: 'Двусторонний протокол Inter-AI Handshake',
      shortDesc: 'Спецификация JSON-ответов сторонних моделей (BYOK) для бесшовного создания задач и заметок.',
      icon: '🔄',
      badge: 'Inter-AI Protocol',
      tags: ['BYOK', 'JSON Schema', 'Action Protocol', 'API'],
      prompt: `Instructions for External AI models connected to Zerf Note via BYOK:
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
    }
  ]

  const handleLoadPromptToManifest = (item: AiPromptItem) => {
    if (item.suggestedManifest) {
      setMName(item.suggestedManifest.name)
      setMTitle(item.suggestedManifest.title)
      setMCategory(item.suggestedManifest.category)
      setMType(item.suggestedManifest.type)
      setMIcon(item.suggestedManifest.icon)
      setMDescription(item.suggestedManifest.description)
      setMTriggers(item.suggestedManifest.triggers)
      setMAiInstructions(item.suggestedManifest.aiInstructions)
      setNavSection('manifest_builder')
    }
  }

  const handleLoadPromptToSandbox = (item: AiPromptItem) => {
    if (item.suggestedSandboxCode) {
      setSandboxCode(item.suggestedSandboxCode)
      setNavSection('live_sandbox')
    } else {
      setNavSection('live_sandbox')
    }
  }

  // Starter Templates Catalog
  const STARTER_TEMPLATES = [
    {
      id: 'ai_research',
      name: 'zerf-plugin-ai-research',
      title: 'AI Deep Research & Fact Checker',
      icon: '🧠',
      badge: 'AI Agent',
      category: 'ИИ & Агенты',
      price: 0,
      description: 'Автономный агент глубокого анализа тем, извлечения ключевых тезисов, проверки фактов и автоматического создания заметок со ссылками.',
      features: [
        'Поиск и структурирование информации по любому вопросу',
        'Генерация структурированного конспекта в папку «Исследования»',
        'Создание связанных Action Items задач со сроками',
        'Поддержка прямых триггеров /research и голосовых команд'
      ],
      manifest: {
        "$schema": "https://zeprh.vercel.app/schemas/extension-v2.json",
        "name": "zerf-plugin-ai-research",
        "title": "AI Deep Research & Fact Checker",
        "version": "1.0.0",
        "description": "Автономный агент глубокого анализа тем и создания структурированных заметок",
        "author": "zerf-community",
        "category": "ИИ & Промпты",
        "type": "widget",
        "icon": "🧠",
        "minPlan": "free",
        "price": 0,
        "permissions": ["tasks:write", "notes:write", "ai:prompt", "ui:notify"],
        "triggers": ["/research", "исследуй тему", "глубокий анализ", "найди факты"],
        "aiInstructions": "Когда пользователь запрашивает исследование темы, выполни глубокий синтез информации, создай заметку с тезисами и сформируй 3 практические задачи."
      },
      widgetCode: '// AI Deep Research Extension Widget\nexport default function initWidget(ZerfContext) {\n  const container = document.createElement("div");\n  container.className = "p-4 rounded-2xl bg-card/80 border border-border/80 space-y-3";\n  container.innerHTML = `<div class="flex items-center justify-between border-b border-border/40 pb-2"><div class="flex items-center gap-2"><span class="text-lg">🧠</span><h4 class="font-bold text-xs text-foreground">AI Deep Research Agent</h4></div><span class="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 text-[10px] font-semibold">Active VM</span></div><div class="space-y-2"><input id="res-query" type="text" placeholder="Введите тему..." class="w-full h-8 px-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none" /><button id="res-btn" class="w-full h-8 rounded-xl bg-primary text-primary-foreground font-bold text-xs">Запустить исследование</button></div>`;\n  return container;\n}',
      readme: '# AI Deep Research & Fact Checker\nПлагин для глубокого исследования тем с использованием Zerf AI.\n\n## Установка\n```bash\nnpx zerf-cli extension install zerf-plugin-ai-research\n```'
    },
    {
      id: 'pomodoro',
      name: 'zerf-plugin-pomodoro',
      title: 'Pomodoro & Focus Interval Timer',
      icon: '⏱️',
      badge: 'Focus Widget',
      category: 'Продуктивность',
      price: 0,
      description: 'Интерактивный таймер фокусировки 25/5 мин со звуковым гонгом, логированием сессий и автоматическим начислением очков продуктивности.',
      features: [
        'Классический интервал Pomodoro (25 мин фокус / 5 мин отдых)',
        'Звуковое оповещение и системный пуш при завершении цикла',
        'Привязка таймера к текущей активной задаче из списка',
        'Учет завершенных помидоров в ежедневный стрик'
      ],
      manifest: {
        "$schema": "https://zeprh.vercel.app/schemas/extension-v2.json",
        "name": "zerf-plugin-pomodoro",
        "title": "Pomodoro Focus Timer & Streak",
        "version": "1.1.0",
        "description": "Таймер фокусировки с интервалами и логированием сессий",
        "author": "zerf-community",
        "category": "Продуктивность",
        "type": "widget",
        "icon": "⏱️",
        "minPlan": "free",
        "price": 0,
        "permissions": ["tasks:read", "tasks:write", "ui:notify"],
        "triggers": ["/pomodoro", "помидор", "таймер фокуса", "запусти 25 минут"],
        "aiInstructions": "Когда пользователь просит запустить таймер фокуса или помидор, активируй 25-минутную сессию."
      },
      widgetCode: '// Pomodoro Focus Timer Widget\nexport default function initPomodoro(ZerfContext) {\n  let timeLeft = 25 * 60;\n  const container = document.createElement("div");\n  container.className = "p-4 rounded-2xl bg-card border border-border space-y-3";\n  container.innerHTML = `<div class="flex items-center justify-between"><h4 class="font-bold text-xs flex items-center gap-1.5 text-foreground"><span>⏱️</span> <span>Pomodoro Focus</span></h4><span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">25 мин</span></div><div class="text-center py-2"><div class="text-3xl font-mono font-bold text-foreground">25:00</div></div>`;\n  return container;\n}',
      readme: '# Pomodoro Focus Timer\nКлассический таймер продуктивности для Zerf Note.'
    },
    {
      id: 'tg_notifier',
      name: 'zerf-plugin-tg-notifier',
      title: 'Telegram Webhook & Event Broadcaster',
      icon: '🤖',
      badge: 'Integration',
      category: 'Интеграции',
      price: 0,
      description: 'Мощный вебхук-мост для мгновенной трансляции событий (создание задачи, дедлайны, заметки) в личный Telegram чат или группу.',
      features: [
        'Webhook Endpoint с валидацией подписи HMAC SHA-256',
        'Фильтрация событий: task.created, task.completed, note.created',
        'Настройка кастомного формата сообщений в Telegram Markdown',
        'Безопасное хранение токена бота в настройках расширения'
      ],
      manifest: {
        "$schema": "https://zeprh.vercel.app/schemas/extension-v2.json",
        "name": "zerf-plugin-tg-notifier",
        "title": "Telegram Webhook Event Broadcaster",
        "version": "1.0.0",
        "description": "Трансляция событий и напоминаний Zerf Note в Telegram",
        "author": "zerf-community",
        "category": "Интеграции",
        "type": "integration",
        "icon": "🤖",
        "minPlan": "free",
        "price": 0,
        "permissions": ["tasks:read", "notes:read", "network:fetch"],
        "triggers": ["/telegram", "настрой тг", "уведомления в группу"],
        "aiInstructions": "При поступлении команд отправки отчета в Telegram, сформируй Markdown сводку и отправь через webhook."
      },
      widgetCode: '// Telegram Webhook Broadcaster\nexport default function initTgNotifier(ZerfContext) {\n  const container = document.createElement("div");\n  container.className = "p-4 rounded-2xl bg-card border border-border space-y-3";\n  container.innerHTML = `<div class="flex items-center justify-between border-b border-border/40 pb-2"><span class="font-bold text-xs text-foreground flex items-center gap-1.5"><span>🤖</span> <span>Telegram Webhook Gateway</span></span><span class="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">Online</span></div><div class="text-[11px] text-muted-foreground">Все новые задачи и дедлайны дублируются в ваш Telegram-канал или чат.</div>`;\n  return container;\n}',
      readme: '# Telegram Webhook Broadcaster\nИнтеграция с Telegram Bot API для мгновенных пушей.'
    },
    {
      id: 'eisenhower',
      name: 'zerf-plugin-eisenhower',
      title: 'Eisenhower Priority Matrix (4 Квадранта)',
      icon: '📊',
      badge: 'Matrix UI',
      category: 'Продуктивность',
      price: 0,
      description: 'Матрица Эйзенхауэра для распределения задач по 4 квадрантам: Срочно/Важно, Не срочно/Важно, Срочно/Не важно, Не срочно/Не важно.',
      features: [
        'Автоматическая классификация задач по срокам и приоритетам',
        'Визуальная сетка 2x2 с цветовой индикацией квадрантов',
        'Быстрый перенос задач между категориями в 1 клик',
        'Интеграция с ИИ для перераспределения перегруженных списков'
      ],
      manifest: {
        "$schema": "https://zeprh.vercel.app/schemas/extension-v2.json",
        "name": "zerf-plugin-eisenhower",
        "title": "Eisenhower Priority Matrix 2x2",
        "version": "1.2.0",
        "description": "Визуальная матрица Эйзенхауэра для приоритизации задач",
        "author": "zerf-community",
        "category": "Продуктивность",
        "type": "widget",
        "icon": "📊",
        "minPlan": "free",
        "price": 0,
        "permissions": ["tasks:read", "tasks:write"],
        "triggers": ["/matrix", "матрица", "эйзенхауэр", "приоритеты дел"],
        "aiInstructions": "При запросе матрицы Эйзенхауэра распредели все задачи пользователя по 4 квадрантам срочности и важности."
      },
      widgetCode: '// Eisenhower Matrix Widget\nexport default function initMatrix(ZerfContext) {\n  const container = document.createElement("div");\n  container.className = "p-4 rounded-2xl bg-card border border-border space-y-3";\n  container.innerHTML = `<div class="flex items-center justify-between border-b border-border/40 pb-2"><span class="font-bold text-xs text-foreground flex items-center gap-1.5"><span>📊</span> <span>Матрица Эйзенхауэра (4 Квадранта)</span></span></div><div class="grid grid-cols-2 gap-2 text-[11px]"><div class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30"><b class="text-rose-400 block mb-1">🔥 1. Срочно & Важно</b><span class="text-muted-foreground text-[10px]">Сделать прямо сейчас</span></div><div class="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30"><b class="text-purple-400 block mb-1">📅 2. Не срочно & Важно</b><span class="text-muted-foreground text-[10px]">Запланировать</span></div></div>`;\n  return container;\n}',
      readme: '# Eisenhower Matrix Widget\nКлассическая матрица Эйзенхауэра для Zerf Note.'
    },
    {
      id: 'cyberpunk_theme',
      name: 'zerf-plugin-theme-cyberpunk',
      title: 'Cyberpunk Neon Glow Theme Preset',
      icon: '🎨',
      badge: 'Theme / UI',
      category: 'Темы & Оформление',
      price: 0,
      description: 'Фирменная неоновая тема оформления в стилистике Cyberpunk 2077 с глубокими фиолетовыми фонами и неоновыми акцентами.',
      features: [
        'Полный набор CSS-переменных для темного режима',
        'Неоновое свечение активных кнопок и карточек задач',
        'Специальная цветовая палитра для графиков и стрика',
        'Совместимость со всеми встроенными разделами Zerf Note'
      ],
      manifest: {
        "$schema": "https://zeprh.vercel.app/schemas/extension-v2.json",
        "name": "zerf-plugin-theme-cyberpunk",
        "title": "Cyberpunk Neon Glow Theme",
        "version": "1.0.0",
        "description": "Неоновая тема оформления для Zerf Note",
        "author": "zerf-community",
        "category": "Темы & Оформление",
        "type": "theme",
        "icon": "🎨",
        "minPlan": "free",
        "price": 0,
        "permissions": ["ui:theme"],
        "triggers": ["/theme cyberpunk", "неоновая тема"],
        "aiInstructions": "Активируй неоновые цвета в оформлении интерфейса."
      },
      widgetCode: '// Cyberpunk Theme CSS Injector\nexport default function initCyberpunkTheme(ZerfContext) {\n  const css = ":root[data-theme=\"cyberpunk\"] { --background: 270 50% 5%; --foreground: 180 100% 90%; --primary: 290 100% 60%; }";\n  const style = document.createElement("style");\n  style.textContent = css;\n  document.head.appendChild(style);\n}',
      readme: '# Cyberpunk Neon Theme\nСтильная неоновая тема для продуктивности в темноте.'
    },
    {
      id: 'calendar_sync',
      name: 'zerf-plugin-calendar-sync',
      title: 'Two-Way Google & Notion Calendar Sync',
      icon: '🔄',
      badge: 'Sync Bridge',
      category: 'Интеграции',
      price: 0,
      description: 'Двусторонняя синхронизация задач и расписания с Google Календарем, Notion Databases и Apple iCal по безопасному протоколу.',
      features: [
        'Автоматический импорт событий календаря в задачи на день',
        'Экспорт задач со временем в Google Calendar',
        'Поддержка персональных iCal фидов (.ics)',
        'Разрешение конфликтов расписания через ИИ'
      ],
      manifest: {
        "$schema": "https://zeprh.vercel.app/schemas/extension-v2.json",
        "name": "zerf-plugin-calendar-sync",
        "title": "Two-Way Calendar Sync Bridge",
        "version": "1.0.0",
        "description": "Синхронизация задач и расписания с внешними календарями",
        "author": "zerf-community",
        "category": "Интеграции",
        "type": "integration",
        "icon": "🔄",
        "minPlan": "free",
        "price": 0,
        "permissions": ["tasks:read", "tasks:write", "network:fetch"],
        "triggers": ["/sync", "синхронизируй календарь", "импорт google"],
        "aiInstructions": "При запросе синхронизации проверь актуальные события внешнего календаря и добавь недостающие задачи."
      },
      widgetCode: '// Calendar Sync Integration\nexport default function initCalendarSync(ZerfContext) {\n  const container = document.createElement("div");\n  container.className = "p-4 rounded-2xl bg-card border border-border space-y-3";\n  container.innerHTML = `<div class="flex items-center justify-between border-b border-border/40 pb-2"><span class="font-bold text-xs text-foreground flex items-center gap-1.5"><span>🔄</span> <span>Calendar Sync Bridge</span></span><span class="text-[10px] text-muted-foreground">iCal / Google</span></div><button id="sync-btn" class="w-full h-8 rounded-xl bg-primary text-primary-foreground font-bold text-xs">Синхронизировать сейчас</button>`;\n  return container;\n}',
      readme: '# Calendar Sync Bridge\nСинхронизация расписания с внешними календарями.'
    }
  ]

  const handleApplyTemplateToBuilder = (tmpl: typeof STARTER_TEMPLATES[0]) => {
    setMName(tmpl.manifest.name)
    setMTitle(tmpl.manifest.title)
    setMCategory(tmpl.manifest.category)
    setMType(tmpl.manifest.type as any)
    setMIcon(tmpl.manifest.icon)
    setMDescription(tmpl.manifest.description)
    setMPrice(tmpl.manifest.price || 0)
    setMTriggers(tmpl.manifest.triggers.join(', '))
    setMAiInstructions(tmpl.manifest.aiInstructions)
    setNavSection('manifest_builder')
  }

  const handleApplyTemplateToSandbox = (tmpl: typeof STARTER_TEMPLATES[0]) => {
    setSandboxCode(tmpl.widgetCode)
    setSandboxCommand(tmpl.manifest.triggers[0] || '/start')
    setNavSection('live_sandbox')
  }

  const handleValidateImportJson = (textToValidate?: string) => {
    const raw = textToValidate !== undefined ? textToValidate : importJsonText
    if (!raw.trim()) {
      setValidationResult({ isValid: false, errors: ['Введите или вставьте JSON-код манифеста для проверки.'], parsed: null })
      return
    }
    try {
      const parsed = JSON.parse(raw)
      const errs: string[] = []
      if (!parsed.name || typeof parsed.name !== 'string') errs.push('Поле "name" обязательно и должно быть строкой (например: "zerf-plugin-timer")')
      if (!parsed.title || typeof parsed.title !== 'string') errs.push('Поле "title" обязательно (название плагина)')
      if (!parsed.version || typeof parsed.version !== 'string') errs.push('Поле "version" обязательно (например: "1.0.0")')
      if (!parsed.type || !['widget', 'template', 'theme', 'integration', 'prompt'].includes(parsed.type)) {
        errs.push('Поле "type" должно быть одним из: widget, template, theme, integration, prompt')
      }
      if (!Array.isArray(parsed.permissions)) {
        errs.push('Поле "permissions" должно быть массивом строк (например: ["tasks:read", "tasks:write"])')
      }
      if (errs.length > 0) {
        setValidationResult({ isValid: false, errors: errs, parsed })
      } else {
        setValidationResult({ isValid: true, errors: [], parsed })
      }
    } catch (e: any) {
      setValidationResult({ isValid: false, errors: ['Синтаксическая ошибка JSON: ' + (e.message || String(e))], parsed: null })
    }
  }

  const handleImportParsedToBuilder = () => {
    if (!validationResult?.parsed) return
    const p = validationResult.parsed
    if (p.name) setMName(p.name)
    if (p.title) setMTitle(p.title)
    if (p.category) setMCategory(p.category)
    if (p.type) setMType(p.type)
    if (p.icon) setMIcon(p.icon)
    if (p.description) setMDescription(p.description)
    if (p.price !== undefined) setMPrice(Number(p.price) || 0)
    if (Array.isArray(p.triggers)) setMTriggers(p.triggers.join(', '))
    if (p.aiInstructions) setMAiInstructions(p.aiInstructions)
    setNavSection('manifest_builder')
  }

  const handleRunWebhookTest = async () => {
    setWhLoading(true)
    setWhResponse(null)
    const startTime = Date.now()
    try {
      let parsedHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      try {
        parsedHeaders = JSON.parse(whHeaders)
      } catch {}

      const fetchOptions: RequestInit = {
        method: whMethod,
        headers: { ...parsedHeaders, ...getAuthHeaders() },
      }
      if (whMethod !== 'GET') {
        fetchOptions.body = whBody
      }

      const res = await fetch(whUrl, fetchOptions)
      const timeMs = Date.now() - startTime
      const resHeaders: Record<string, string> = {}
      res.headers.forEach((val, key) => { resHeaders[key] = val })
      let resData: any = null
      const text = await res.text()
      try {
        resData = JSON.parse(text)
      } catch {
        resData = text
      }

      setWhResponse({
        status: res.status,
        statusText: res.statusText || (res.ok ? 'OK' : 'Error'),
        timeMs,
        headers: resHeaders,
        body: typeof resData === 'object' ? JSON.stringify(resData, null, 2) : String(resData)
      })
    } catch (e: any) {
      setWhResponse({
        status: 0,
        statusText: 'Network / Connection Error',
        timeMs: Date.now() - startTime,
        headers: {},
        body: 'Ошибка отправки запроса: ' + (e.message || String(e))
      })
    } finally {
      setWhLoading(false)
    }
  }

  const handleRunCliCommand = (cmdToRun?: string) => {
    const rawCmd = (cmdToRun !== undefined ? cmdToRun : cliCommandInput).trim()
    if (!rawCmd) return
    setCliCommandInput('')

    const now = new Date().toLocaleTimeString()
    let outputText = ''
    let status: 'ok' | 'err' | 'info' = 'ok'

    if (rawCmd === 'clear' || rawCmd === 'cls') {
      setCliLogs([])
      return
    } else if (rawCmd === 'zerf --help' || rawCmd === 'zerf -h' || rawCmd === 'help') {
      outputText = 'Zerf Developer CLI v2.6.0\nКоманды:\n  zerf init <name>       Создать новый проект расширения по шаблону\n  zerf dev [--port 3000] Запустить локальный сервер разработки с Live Reload\n  zerf test              Проверить zerf-extension.json и прогнать тесты\n  zerf login             Авторизовать сессию разработчика\n  zerf publish           Опубликовать расширение в Каталог Zerf Note\n  zerf docs              Открыть справочник SDK API\n  zerf --version         Показать версию CLI'
    } else if (rawCmd.startsWith('zerf init')) {
      const pkg = rawCmd.split(' ')[2] || 'my-zerf-widget'
      outputText = '[1/4] 🚀 Создание проекта ' + pkg + '...\n[2/4] 📦 Генерация zerf-extension.json и widget.js\n[3/4] ⚙️ Настройка TypeScript и Jest тестов\n[4/4] ✓ Проект ' + pkg + ' успешно создан!\nДля запуска выполните:\n  cd ' + pkg + ' && zerf dev'
    } else if (rawCmd.startsWith('zerf dev')) {
      outputText = '⚡ [Zerf Dev Server] запущен на http://localhost:3000\n🔗 Live Sandbox подключен к студии Zerf Note\n✓ Hot Reload активен (0 ошибок компиляции)'
    } else if (rawCmd.startsWith('zerf test')) {
      outputText = '🧪 Проверка расширения...\n✓ Манифест zerf-extension.json валиден (V2 Schema)\n✓ Все 4 разрешения корректно объявлены\n✓ Сборка widget.js прошла без предупреждений (Bundle: 4.2 KB)\n✓ 3/3 тестов успешно пройдены (140 ms)'
    } else if (rawCmd.startsWith('zerf login')) {
      outputText = '🔑 Проверка токена разработчика...\n✓ Успешный вход в систему Zerf Dev: @waters1ze\n✓ Баланс выплат ЮMoney привязан: 80% доход автора'
    } else if (rawCmd.startsWith('zerf publish')) {
      outputText = '🚀 Сборка релиза для Магазина Zerf Note...\n✓ Хэш-сумма пакета: sha256:e8f7a90b...\n✓ Загрузка в каталог расширений...\n🎉 Релиз успешно опубликован и доступен в Магазине Zerf Note!'
    } else if (rawCmd === 'zerf --version' || rawCmd === 'zerf -v') {
      outputText = 'zerf-cli v2.6.0 (x64-node20.11) - Official Zerf Note Command Line'
    } else {
      outputText = 'zerf: неизвестная команда "' + rawCmd + '". Введите "zerf --help" для списка команд.'
      status = 'err'
    }

    setCliLogs(prev => [
      ...prev,
      { id: String(Date.now()), command: rawCmd, output: outputText, time: now, status }
    ])
  }

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
      title: 'ДОХОД & МОНЕТИЗАЦИЯ',
      items: [
        { id: 'earnings', label: 'Баланс автора & ЮMoney', icon: CreditCard, badge: '80/20' },
      ]
    },
    {
      title: 'СПРАВОЧНИК & SDK',
      items: [
        { id: 'sdk_docs', label: 'Справочник SDK API', icon: BookOpen },
        { id: 'cli_tools', label: 'Zerf CLI & Терминал', icon: Terminal, badge: 'CLI' },
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className={cn(
        'w-full md:w-64 border-r border-border bg-card/60 backdrop-blur-xl p-4 flex flex-col justify-between shrink-0 transition-all duration-300',
        sidebarCollapsed && 'md:w-20'
      )}>
        <div className="space-y-6">
          {/* Back to Home Button & Sidebar Toggle */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <a
              href="/"
              className="flex items-center gap-3 p-1.5 pr-3 rounded-2xl bg-card hover:bg-primary hover:text-primary-foreground text-foreground border border-border hover:border-primary/40 transition-all cursor-pointer group shadow-xs"
              title="Вернуться на главную страницу"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/15 group-hover:bg-black/20 flex items-center justify-center text-primary group-hover:text-primary-foreground transition-colors shrink-0">
                <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0 pr-1">
                  <span className="font-bold text-xs block leading-tight">На главную</span>
                  <span className="text-[10px] text-muted-foreground group-hover:text-primary-foreground/80">Zerf Note</span>
                </div>
              )}
            </a>
            
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Search */}
          {!sidebarCollapsed && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Поиск по разделам..."
                value={searchNav}
                onChange={e => setSearchNav(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              />
            </div>
          )}

          {/* Navigation Groups */}
          <div className="space-y-5 overflow-y-auto max-h-[calc(100vh-250px)] scrollbar-none pr-1">
            {NAV_GROUPS.map((grp, gIdx) => {
              const filteredItems = grp.items.filter(it => 
                searchNav ? it.label.toLowerCase().includes(searchNav.toLowerCase()) : true
              )
              if (filteredItems.length === 0) return null

              return (
                <div key={gIdx} className="space-y-1">
                  {!sidebarCollapsed && (
                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase px-2.5 block mb-1.5">
                      {grp.title}
                    </span>
                  )}
                  <div className="space-y-0.5">
                    {filteredItems.map(item => {
                      const Icon = item.icon
                      const isActive = navSection === item.id

                      return (
                        <button
                          key={item.id}
                          onClick={() => setNavSection(item.id as NavSection)}
                          className={cn(
                            'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer group',
                            isActive
                              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          )}
                          title={sidebarCollapsed ? item.label : undefined}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-primary')} />
                            {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                          </div>

                          {!sidebarCollapsed && item.badge && (
                            <span className={cn(
                              'text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider',
                              isActive ? 'bg-black/20 text-white' : 'bg-muted text-muted-foreground'
                            )}>
                              {item.badge}
                            </span>
                          )}

                          {!sidebarCollapsed && item.dotColor && !item.badge && (
                            <span className={cn('w-2 h-2 rounded-full', item.dotColor)} />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sidebar Footer / Balance Card */}
        {!sidebarCollapsed && (
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-2 mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-semibold">Баланс автора:</span>
              <span className="font-bold text-emerald-400 font-mono">{authorStats.balance} ₽</span>
            </div>
            <button
              onClick={() => setNavSection('earnings')}
              className="w-full py-1.5 rounded-xl bg-card hover:bg-muted border border-border text-foreground font-semibold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5 text-purple-400" />
              <span>Вывод средств</span>
            </button>
          </div>
        )}
      </aside>

      {/* MAIN VIEW AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Header Breadcrumbs */}
        <header className="h-16 border-b border-border bg-card/30 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground truncate min-w-0">
            <span className="text-muted-foreground capitalize hidden md:inline">Студия</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground hidden md:inline" />
            <span className="text-primary truncate">
              {navSection === 'manifest_builder' && 'Конструктор манифеста'}
              {navSection === 'universal_template' && 'Универсальный шаблон'}
              {navSection === 'import_export' && 'Импорт / Экспорт JSON'}
              {navSection === 'live_sandbox' && 'Live Sandbox & Изолятор'}
              {navSection === 'webhook_tester' && 'Webhook & REST Tester'}
              {navSection === 'publish_github' && 'Публикация из GitHub'}
              {navSection === 'my_releases' && 'Мои плагины & Релизы'}
              {navSection === 'ai_prompts' && 'AI Промпты & Скиллы'}
              {navSection === 'ui_kit' && 'UI Kit & Темы оформления'}
              {navSection === 'inter_ai_protocol' && 'Двусторонний протокол'}
              {navSection === 'earnings' && 'Баланс автора & ЮMoney'}
              {navSection === 'sdk_docs' && 'Справочник SDK API'}
              {navSection === 'cli_tools' && 'Zerf CLI & Терминал'}
            </span>
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
              VIEW 1: MANIFEST BUILDER (Visual Form)
          ══════════════════════════════════════════════════════════════ */}
          {navSection === 'manifest_builder' && (
            <div className="space-y-6">
              {/* Top Banner */}
              <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-900/30 via-primary/15 to-transparent border border-primary/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-primary" />
                    <span>Визуальный конструктор манифеста zerf-extension.json</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Заполните параметры расширения, настройте разрешения и сгенерируйте готовый манифест V2
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setNavSection('universal_template')}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Открыть каталог шаблонов</span>
                  </button>
                  <button
                    onClick={() => setNavSection('import_export')}
                    className="px-3.5 py-1.5 rounded-xl bg-card hover:bg-muted text-foreground border border-border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Импорт JSON</span>
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
                      <label className="font-semibold text-foreground">Категория</label>
                      <input
                        type="text"
                        value={mCategory}
                        onChange={e => setMCategory(e.target.value)}
                        placeholder="Продуктивность, ИИ, Интеграции..."
                        className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs"
                      />
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

                  <pre className="flex-1 p-4 rounded-2xl bg-zinc-950 text-emerald-400 font-mono text-xs overflow-auto max-h-[500px] border border-border/60 leading-relaxed">
                    {manifestJsonString}
                  </pre>

                  <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                    <button
                      onClick={() => setNavSection('live_sandbox')}
                      className="flex-1 h-9 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Тестировать в Sandbox</span>
                    </button>
                    <button
                      onClick={() => setNavSection('publish_github')}
                      className="flex-1 h-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Опубликовать из GitHub</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIEW 2: UNIVERSAL STARTER TEMPLATES
          ══════════════════════════════════════════════════════════════ */}
          {navSection === 'universal_template' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-transparent border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span>Универсальные готовые шаблоны расширений (Starter Presets)</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Выберите полноценный рабочий шаблон с готовым манифестом, кодом виджета и интеграцией с ZerfContext API
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleDownloadStarterKit}
                    className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Скачать весь Starter Kit (.zip)</span>
                  </button>
                </div>
              </div>

              {/* Template Grid & Inspector */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Left: Template Cards List */}
                <div className="space-y-3">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-1">
                    Готовые пресеты ({STARTER_TEMPLATES.length}):
                  </h3>
                  {STARTER_TEMPLATES.map(tmpl => {
                    const isSelected = selectedTemplateId === tmpl.id
                    return (
                      <div
                        key={tmpl.id}
                        onClick={() => setSelectedTemplateId(tmpl.id)}
                        className={cn(
                          'p-4 rounded-2xl border transition-all cursor-pointer space-y-2',
                          isSelected
                            ? 'bg-card border-primary ring-2 ring-primary/30 shadow-md'
                            : 'bg-card/60 hover:bg-card border-border hover:border-border/80'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{tmpl.icon}</span>
                            <div>
                              <h4 className="font-bold text-xs text-foreground leading-tight">{tmpl.title}</h4>
                              <span className="text-[10px] text-muted-foreground font-mono">{tmpl.name}</span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
                            {tmpl.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                          {tmpl.description}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {/* Right: Active Template Inspector (2 cols) */}
                <div className="lg:col-span-2 space-y-4">
                  {(() => {
                    const activeTmpl = STARTER_TEMPLATES.find(t => t.id === selectedTemplateId) || STARTER_TEMPLATES[0]
                    return (
                      <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-5">
                        
                        {/* Template Header & Actions */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-2xl shrink-0">
                              {activeTmpl.icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-sm text-foreground">{activeTmpl.title}</h3>
                                <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                                  {activeTmpl.category}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 font-mono">{activeTmpl.name}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => handleApplyTemplateToBuilder(activeTmpl)}
                              className="px-3.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <Code2 className="w-3.5 h-3.5" />
                              <span>В Конструктор</span>
                            </button>
                            <button
                              onClick={() => handleApplyTemplateToSandbox(activeTmpl)}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>В Sandbox VM</span>
                            </button>
                          </div>
                        </div>

                        {/* Features Pill List */}
                        <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2 text-xs">
                          <span className="font-bold text-foreground block">Ключевые возможности:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
                            {activeTmpl.features.map((feat, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Code Tabs */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-border pb-2">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setTemplateCodeTab('manifest')}
                                className={cn(
                                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                                  templateCodeTab === 'manifest' ? 'bg-primary/20 text-primary border border-primary/40' : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                zerf-extension.json
                              </button>
                              <button
                                onClick={() => setTemplateCodeTab('code')}
                                className={cn(
                                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                                  templateCodeTab === 'code' ? 'bg-primary/20 text-primary border border-primary/40' : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                widget.js (Код)
                              </button>
                              <button
                                onClick={() => setTemplateCodeTab('readme')}
                                className={cn(
                                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                                  templateCodeTab === 'readme' ? 'bg-primary/20 text-primary border border-primary/40' : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                README.md
                              </button>
                            </div>

                            <button
                              onClick={() => {
                                const content = templateCodeTab === 'manifest'
                                  ? JSON.stringify(activeTmpl.manifest, null, 2)
                                  : templateCodeTab === 'code'
                                  ? activeTmpl.widgetCode
                                  : activeTmpl.readme
                                copyToClipboard(content, 'template_tab_copy')
                              }}
                              className="px-3 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                            >
                              {copiedId === 'template_tab_copy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedId === 'template_tab_copy' ? 'Скопировано!' : 'Копировать'}</span>
                            </button>
                          </div>

                          <pre className="p-4 rounded-2xl bg-zinc-950 text-emerald-400 font-mono text-xs overflow-auto max-h-[380px] border border-border/60 leading-relaxed whitespace-pre-wrap">
                            {templateCodeTab === 'manifest' && JSON.stringify(activeTmpl.manifest, null, 2)}
                            {templateCodeTab === 'code' && activeTmpl.widgetCode}
                            {templateCodeTab === 'readme' && activeTmpl.readme}
                          </pre>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIEW 3: IMPORT / EXPORT & JSON SCHEMA VALIDATOR
          ══════════════════════════════════════════════════════════════ */}
          {navSection === 'import_export' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-900/30 via-primary/15 to-transparent border border-blue-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Upload className="w-5 h-5 text-blue-400" />
                    <span>Импорт, Экспорт & Валидация схемы JSON манифеста</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Вставьте готовый JSON, проверьте на соответствие схеме Manifest V2 или экспортируйте манифест в файл
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setImportJsonText(manifestJsonString)
                      handleValidateImportJson(manifestJsonString)
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Вставить из Конструктора</span>
                  </button>
                </div>
              </div>

              {/* Two Column Layout: Editor vs Validation Result */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* Left: JSON Input Textarea */}
                <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
                      <Code2 className="w-4 h-4 text-primary" />
                      <span>JSON манифест расширения</span>
                    </h3>
                    <button
                      onClick={() => handleValidateImportJson()}
                      className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all cursor-pointer shadow-xs"
                    >
                      Проверить схему
                    </button>
                  </div>

                  <textarea
                    value={importJsonText}
                    onChange={e => {
                      setImportJsonText(e.target.value)
                      handleValidateImportJson(e.target.value)
                    }}
                    placeholder="Вставьте сюда содержимое zerf-extension.json..."
                    rows={16}
                    className="w-full p-4 rounded-2xl bg-zinc-950 text-cyan-300 font-mono text-xs outline-none border border-border/60 resize-none leading-relaxed"
                  />

                  {/* Drag & Drop File Helper */}
                  <div className="p-4 rounded-2xl border-2 border-dashed border-border/80 hover:border-primary/50 text-center transition-colors">
                    <input
                      type="file"
                      accept=".json"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = ev => {
                            const content = String(ev.target?.result || '')
                            setImportJsonText(content)
                            handleValidateImportJson(content)
                          }
                          reader.readAsText(file)
                        }
                      }}
                      className="hidden"
                      id="json-file-upload"
                    />
                    <label htmlFor="json-file-upload" className="cursor-pointer space-y-1 block">
                      <Upload className="w-6 h-6 text-muted-foreground mx-auto" />
                      <p className="text-xs font-semibold text-foreground">Перетащите сюда zerf-extension.json или выберите файл</p>
                      <p className="text-[10px] text-muted-foreground">Форматы: .json (UTF-8)</p>
                    </label>
                  </div>
                </div>

                {/* Right: Validation & Export Hub */}
                <div className="space-y-4">
                  {/* Validation Report Card */}
                  <div className={cn(
                    'p-6 rounded-3xl border shadow-xs space-y-4 text-xs',
                    validationResult?.isValid
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : validationResult?.errors?.length
                      ? 'bg-rose-500/10 border-rose-500/30'
                      : 'bg-card border-border'
                  )}>
                    <div className="flex items-center justify-between border-b border-border/40 pb-3">
                      <span className="font-bold flex items-center gap-2">
                        {validationResult?.isValid ? (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <span className="text-emerald-300 font-bold">Схема Manifest V2 валидна!</span>
                          </>
                        ) : validationResult?.errors?.length ? (
                          <>
                            <AlertCircle className="w-5 h-5 text-rose-400" />
                            <span className="text-rose-300 font-bold">Обнаружены ошибки в схеме</span>
                          </>
                        ) : (
                          <>
                            <Info className="w-5 h-5 text-primary" />
                            <span>Ожидание проверки JSON</span>
                          </>
                        )}
                      </span>
                    </div>

                    {validationResult?.errors && validationResult.errors.length > 0 && (
                      <div className="space-y-1.5 text-rose-300 text-[11px] p-3 rounded-xl bg-black/20">
                        {validationResult.errors.map((err, i) => (
                          <p key={i}>• {err}</p>
                        ))}
                      </div>
                    )}

                    {validationResult?.parsed && validationResult.isValid && (
                      <div className="space-y-2 text-[11px]">
                        <div className="p-3 rounded-xl bg-black/20 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Package ID:</span>
                            <b className="font-mono text-foreground">{validationResult.parsed.name}</b>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Название:</span>
                            <b className="text-foreground">{validationResult.parsed.title}</b>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Версия:</span>
                            <b className="font-mono text-emerald-400">v{validationResult.parsed.version}</b>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Тип расширения:</span>
                            <b className="text-foreground">{validationResult.parsed.type}</b>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Разрешения:</span>
                            <b className="text-primary">{Array.isArray(validationResult.parsed.permissions) ? validationResult.parsed.permissions.length : 0} шт.</b>
                          </div>
                        </div>

                        <button
                          onClick={handleImportParsedToBuilder}
                          className="w-full h-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Применить манифест в Конструктор</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Export Options Box */}
                  <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-4">
                    <h3 className="font-bold text-sm flex items-center gap-2 border-b border-border pb-3 text-foreground">
                      <Download className="w-4 h-4 text-primary" />
                      <span>Экспорт & Готовые файлы</span>
                    </h3>

                    <div className="space-y-2.5">
                      <button
                        onClick={() => {
                          const blob = new Blob([manifestJsonString], { type: 'application/json' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = 'zerf-extension.json'
                          a.click()
                        }}
                        className="w-full h-9 px-4 rounded-xl bg-muted/60 hover:bg-muted border border-border text-foreground font-semibold text-xs transition-all flex items-center justify-between cursor-pointer"
                      >
                        <span>💾 Скачать zerf-extension.json (Formatted)</span>
                        <Download className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>

                      <button
                        onClick={() => {
                          try {
                            const minified = JSON.stringify(JSON.parse(manifestJsonString))
                            copyToClipboard(minified, 'minified_json')
                          } catch {
                            copyToClipboard(manifestJsonString, 'minified_json')
                          }
                        }}
                        className="w-full h-9 px-4 rounded-xl bg-muted/60 hover:bg-muted border border-border text-foreground font-semibold text-xs transition-all flex items-center justify-between cursor-pointer"
                      >
                        <span>📋 {copiedId === 'minified_json' ? 'Скопировано в буфер!' : 'Скопировать Minified JSON (1 строка)'}</span>
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>

                      <button
                        onClick={handleDownloadStarterKit}
                        className="w-full h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition-all flex items-center justify-between cursor-pointer shadow-xs"
                      >
                        <span>📦 Скачать полный архив расширения (.zip)</span>
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIEW 4: LIVE SANDBOX & VM RUNNER
          ══════════════════════════════════════════════════════════════ */}
          {navSection === 'live_sandbox' && (
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
              VIEW 5: WEBHOOK & REST API TESTER
          ══════════════════════════════════════════════════════════════ */}
          {navSection === 'webhook_tester' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="p-5 rounded-3xl bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-400" />
                    <span>Интерактивный тестер Webhook & REST API</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Отправляйте тестовые события жизненного цикла Zerf Note на ваш сервер и проверяйте обработку входящих запросов
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs font-semibold">
                    HTTP Dispatcher Active
                  </span>
                </div>
              </div>

              {/* URL & Method Selector Bar */}
              <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={whMethod}
                    onChange={e => setWhMethod(e.target.value as any)}
                    className="h-10 px-3 rounded-xl bg-muted/60 border border-border text-xs font-bold text-foreground outline-none focus:border-primary shrink-0 cursor-pointer"
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>

                  <input
                    type="text"
                    value={whUrl}
                    onChange={e => setWhUrl(e.target.value)}
                    placeholder="https://api.yourdomain.com/v1/zerf-hook"
                    className="flex-1 h-10 px-3.5 rounded-xl bg-muted/40 border border-border text-xs text-foreground font-mono outline-none focus:border-primary"
                  />

                  <button
                    onClick={handleRunWebhookTest}
                    disabled={whLoading || !whUrl.trim()}
                    className="h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {whLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>{whLoading ? 'Отправка...' : 'Отправить запрос'}</span>
                  </button>
                </div>

                {/* Preset Events Bar */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
                  <span className="text-[11px] text-muted-foreground font-semibold">Пресеты событий:</span>
                  {[
                    { id: 'task_created', label: '📋 task.created', body: { event: 'task.created', timestamp: new Date().toISOString(), task: { id: 't-101', title: 'Подготовить релиз плагина', priority: 'high', dueDate: '2026-08-22' } } },
                    { id: 'task_completed', label: '✅ task.completed', body: { event: 'task.completed', timestamp: new Date().toISOString(), taskId: 't-101', completedAt: new Date().toISOString() } },
                    { id: 'note_created', label: '📝 note.created', body: { event: 'note.created', timestamp: new Date().toISOString(), note: { id: 'n-201', title: 'Конспект встречи', folder: 'Работа' } } },
                    { id: 'ai_trigger', label: '⚡ ai.prompt_trigger', body: { event: 'ai.prompt_trigger', trigger: '/research', prompt: 'Изучи тренды веб-разработки 2026', userId: 'user_6136950061' } },
                    { id: 'user_auth', label: '👤 user.auth', body: { event: 'user.auth', authProvider: 'telegram', userId: '6136950061', plan: 'pro' } }
                  ].map(pst => (
                    <button
                      key={pst.id}
                      onClick={() => {
                        setWhPreset(pst.id)
                        setWhBody(JSON.stringify(pst.body, null, 2))
                      }}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer',
                        whPreset === pst.id
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {pst.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Request & Response Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* Left: Request Payload & Headers */}
                <div className="p-5 rounded-3xl bg-card border border-border shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <h3 className="font-bold text-xs text-foreground">Request Body (JSON Payload)</h3>
                    <span className="text-[10px] text-muted-foreground font-mono">application/json</span>
                  </div>

                  <textarea
                    value={whBody}
                    onChange={e => setWhBody(e.target.value)}
                    rows={12}
                    className="w-full p-3.5 rounded-2xl bg-zinc-950 text-purple-300 font-mono text-xs outline-none border border-border/60 resize-none leading-relaxed"
                  />

                  <div className="space-y-1 pt-1">
                    <label className="font-semibold text-foreground text-[11px]">HTTP Headers (JSON):</label>
                    <textarea
                      value={whHeaders}
                      onChange={e => setWhHeaders(e.target.value)}
                      rows={3}
                      className="w-full p-2 rounded-xl bg-zinc-950 text-zinc-300 font-mono text-[11px] outline-none border border-border/60 resize-none"
                    />
                  </div>
                </div>

                {/* Right: Response Inspector */}
                <div className="p-5 rounded-3xl bg-card border border-border shadow-xs space-y-4 h-full flex flex-col">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <h3 className="font-bold text-xs text-foreground flex items-center gap-2">
                      <Radio className="w-4 h-4 text-emerald-400" />
                      <span>Response Inspector</span>
                    </h3>

                    {whResponse && (
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold',
                          whResponse.status >= 200 && whResponse.status < 300
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        )}>
                          {whResponse.status} {whResponse.statusText}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {whResponse.timeMs} ms
                        </span>
                      </div>
                    )}
                  </div>

                  {whResponse ? (
                    <div className="space-y-3 flex-1 flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground font-semibold">Response Body:</span>
                        <button
                          onClick={() => copyToClipboard(whResponse.body, 'wh_res_copy')}
                          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          {copiedId === 'wh_res_copy' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedId === 'wh_res_copy' ? 'Скопировано' : 'Копировать'}</span>
                        </button>
                      </div>

                      <pre className="flex-1 p-4 rounded-2xl bg-zinc-950 text-emerald-400 font-mono text-xs overflow-auto max-h-[380px] border border-border/60 leading-relaxed whitespace-pre-wrap">
                        {whResponse.body}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-2 border border-dashed border-border/60 rounded-2xl">
                      <Activity className="w-8 h-8 opacity-40 text-purple-400" />
                      <p className="text-xs font-semibold">Ожидание отправки запроса</p>
                      <p className="text-[11px] max-w-xs opacity-80">Нажмите «Отправить запрос», чтобы увидеть статус ответа, задержку и заголовки</p>
                    </div>
                  )}
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

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowPatInput(!showPatInput)}
                      className="px-3 py-1.5 rounded-xl bg-card border border-border text-foreground hover:bg-muted/60 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Указать токен для доступа к приватным репозиториям"
                    >
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      <span>Приватные репозитории</span>
                    </button>
                    {!userGh && (
                      <a
                        href="/settings"
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs shrink-0 cursor-pointer shadow-xs"
                      >
                        Привязать в Настройках
                      </a>
                    )}
                  </div>
                </div>

                {/* PAT Token / OAuth Banner for Private Repositories */}
                {showPatInput && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5" />
                        <span>Доступ к приватным репозиториям GitHub</span>
                      </p>
                      <a
                        href="/api/auth/github"
                        className="text-[10px] text-primary hover:underline font-semibold"
                      >
                        Войти через OAuth (repo) →
                      </a>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Для чтения ваших приватных репозиториев укажите Personal Access Token (PAT) с правами `repo` или войдите через OAuth:
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        value={customPatToken}
                        onChange={e => setCustomPatToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        className="flex-1 h-8 px-3 rounded-xl bg-background border border-border text-xs text-foreground font-mono outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={handleSavePat}
                        disabled={savingPat || !customPatToken.trim()}
                        className="px-3.5 h-8 rounded-xl bg-primary text-primary-foreground font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        {savingPat ? 'Сохранение...' : 'Сохранить'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Mode Switcher */}
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <button
                    type="button"
                    onClick={() => setPublishMode('picker')}
                    className={cn(
                      'px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer',
                      publishMode === 'picker'
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <GithubIcon className="w-3.5 h-3.5" />
                    <span>Выбрать из моих репозиториев {userGh ? `(@${userGh})` : ''}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPublishMode('manual')}
                    className={cn(
                      'px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer',
                      publishMode === 'manual'
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Вставить ссылку вручную</span>
                  </button>
                </div>

                {publishMode === 'picker' ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      {/* Search & Privacy Filters */}
                      <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={repoSearchFilter}
                            onChange={e => setRepoSearchFilter(e.target.value)}
                            placeholder="Поиск по проектам на GitHub..."
                            className="w-full h-8 pl-8 pr-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary placeholder:text-muted-foreground/70"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setRepoTypeFilter('all')}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer',
                            repoTypeFilter === 'all' ? 'bg-card text-foreground border border-border shadow-xs' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          Все ({userRepos.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setRepoTypeFilter('public')}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer',
                            repoTypeFilter === 'public' ? 'bg-card text-foreground border border-border shadow-xs' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          🌐 Публичные ({userRepos.filter(r => !r.isPrivate).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setRepoTypeFilter('private')}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer',
                            repoTypeFilter === 'private' ? 'bg-card text-foreground border border-border shadow-xs' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          🔒 Приватные ({userRepos.filter(r => r.isPrivate).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => fetchUserRepos()}
                          disabled={loadingUserRepos}
                          className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="Обновить список репозиториев"
                        >
                          <RefreshCw className={cn('w-3.5 h-3.5', loadingUserRepos && 'animate-spin')} />
                        </button>
                      </div>
                    </div>

                    {/* Repository cards list */}
                    {loadingUserRepos ? (
                      <div className="p-8 rounded-2xl bg-muted/20 border border-border text-center space-y-2">
                        <RefreshCw className="w-5 h-5 text-primary animate-spin mx-auto" />
                        <p className="text-xs text-muted-foreground">Загрузка репозиториев с GitHub...</p>
                      </div>
                    ) : userRepos.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-muted/20 border border-border text-center space-y-2">
                        <p className="text-xs font-bold text-foreground">Репозитории не найдены</p>
                        <p className="text-[11px] text-muted-foreground">
                          {userGh
                            ? `В аккаунте @${userGh} не найдено репозиториев, либо переключитесь на ручной ввод ссылки.`
                            : 'Привяжите GitHub аккаунт в Настройках, чтобы видеть список ваших репозиториев.'}
                        </p>
                        <button
                          type="button"
                          onClick={() => fetchUserRepos()}
                          className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold cursor-pointer"
                        >
                          Обновить
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                        {userRepos
                          .filter(r => {
                            if (repoTypeFilter === 'public' && r.isPrivate) return false
                            if (repoTypeFilter === 'private' && !r.isPrivate) return false
                            if (!repoSearchFilter) return true
                            return (
                              r.name.toLowerCase().includes(repoSearchFilter.toLowerCase()) ||
                              r.description.toLowerCase().includes(repoSearchFilter.toLowerCase()) ||
                              r.language.toLowerCase().includes(repoSearchFilter.toLowerCase())
                            )
                          })
                          .map(repo => {
                            const isSelected = publishRepoUrl === repo.htmlUrl
                            return (
                              <div
                                key={repo.fullName}
                                className={cn(
                                  'p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 group',
                                  isSelected
                                    ? 'bg-primary/10 border-primary/50 shadow-xs'
                                    : 'bg-card border-border hover:border-primary/40'
                                )}
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                                      {repo.name}
                                    </h4>
                                    <span className={cn(
                                      'px-1.5 py-0.5 rounded text-[9px] font-mono shrink-0',
                                      repo.isPrivate
                                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                    )}>
                                      {repo.isPrivate ? '🔒 Private' : '🌐 Public'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
                                    {repo.description || 'Репозиторий проекта GitHub'}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[10px] text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    {repo.language && (
                                      <span className="font-mono">{repo.language}</span>
                                    )}
                                    {repo.stars > 0 && (
                                      <span className="text-amber-400 font-mono">★ {repo.stars}</span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleValidateGithubRepo(repo.htmlUrl)}
                                    disabled={publishValidating}
                                    className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all hover:bg-primary/90 shadow-2xs"
                                  >
                                    <span>Выбрать</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Manual URL Input */
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
                        onClick={() => handleValidateGithubRepo()}
                        disabled={publishValidating || !publishRepoUrl.trim()}
                        className="h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        {publishValidating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        <span>Проверить и спарсить</span>
                      </button>
                    </div>
                  </div>
                )}

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
                          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          <span>Опубликовать в Каталог Zerf Note</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIEW 4: AUTHOR EARNINGS & YOOMONEY PAYOUTS
          ══════════════════════════════════════════════════════════════ */}
          {navSection === 'earnings' && (
            <div className="space-y-6 max-w-4xl">
              <div className="p-6 rounded-3xl bg-card border border-border space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <h2 className="text-base font-bold flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-purple-400" />
                      <span>Баланс автора & Выплаты на ЮMoney</span>
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Доход с продажи плагинов начисляется мгновенно (80% автору, 20% платформе)
                    </p>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold font-mono">
                    80% Сплит
                  </span>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-1">
                    <span className="text-[11px] text-muted-foreground">Доступно к выводу:</span>
                    <p className="text-2xl font-black text-emerald-400 font-mono">{authorStats.balance} ₽</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-1">
                    <span className="text-[11px] text-muted-foreground">Всего заработано:</span>
                    <p className="text-2xl font-black text-foreground font-mono">{authorStats.totalEarned} ₽</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-1">
                    <span className="text-[11px] text-muted-foreground">Количество продаж:</span>
                    <p className="text-2xl font-black text-primary font-mono">{authorStats.salesCount} шт.</p>
                  </div>
                </div>

                {/* Payout Destination Card */}
                <div className="p-5 rounded-2xl bg-muted/30 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-primary" />
                      <span>Реквизиты для автоматических выплат</span>
                    </span>

                    <button
                      onClick={() => setShowDevYoomoneyModal(!showDevYoomoneyModal)}
                      className="px-3 py-1 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {boundCard?.cardNumber ? 'Изменить' : '+ Привязать кошелёк'}
                    </button>
                  </div>

                  {boundCard?.cardNumber ? (
                    <div className="p-3.5 rounded-xl bg-card border border-border flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🟣</span>
                        <div>
                          <p className="font-bold text-foreground">{boundCard.bankName || 'ЮMoney'}</p>
                          <p className="text-muted-foreground font-mono">{boundCard.cardNumber}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                        Активен для выплат
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Кошелёк ЮMoney или карта не привязаны. Привяжите реквизиты, чтобы получать выплаты с продаж ваших расширений.
                    </p>
                  )}
                </div>

                {/* Payout Edit Form */}
                {showDevYoomoneyModal && (
                  <form onSubmit={handleSaveDevPayoutDetails} className="p-5 rounded-2xl bg-card border border-primary/30 space-y-4 text-xs">
                    <h3 className="font-bold text-foreground">Настройка реквизитов ЮMoney / Банковской карты</h3>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="font-semibold text-foreground">Тип выплаты:</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => { setDevCardPayoutType('yoomoney'); setDevCardBank('ЮMoney') }}
                            className={cn(
                              'py-2 rounded-xl border font-semibold transition-all cursor-pointer',
                              devCardPayoutType === 'yoomoney' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 border-border text-muted-foreground'
                            )}
                          >
                            🟣 ЮMoney Кошелёк (4100...)
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDevCardPayoutType('card'); setDevCardBank('Банковская карта') }}
                            className={cn(
                              'py-2 rounded-xl border font-semibold transition-all cursor-pointer',
                              devCardPayoutType === 'card' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 border-border text-muted-foreground'
                            )}
                          >
                            💳 Банковская карта РФ (МИР / Visa / MC)
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-foreground">
                          {devCardPayoutType === 'yoomoney' ? 'Номер кошелька ЮMoney (11-16 цифр):' : 'Номер банковской карты (16-19 цифр):'}
                        </label>
                        <input
                          type="text"
                          required
                          value={devCardNumber}
                          onChange={e => setDevCardNumber(e.target.value.replace(/\D/g, ''))}
                          placeholder={devCardPayoutType === 'yoomoney' ? '410011234567890' : '2200 0000 0000 0000'}
                          className="w-full h-9 px-3.5 rounded-xl bg-muted/40 border border-border font-mono text-foreground outline-none focus:border-primary text-xs"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowDevYoomoneyModal(false)}
                          className="px-3.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Отмена
                        </button>
                        <button
                          type="submit"
                          disabled={payoutLoading}
                          className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {payoutLoading ? 'Сохранение...' : 'Сохранить реквизиты'}
                        </button>
                      </div>
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
              VIEW 5: AI PROMPTS & SKILLS
          ══════════════════════════════════════════════════════════════ */}
          {navSection === 'ai_prompts' && (
            <div className="space-y-6 max-w-5xl">
              <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-4">
                <div className="border-b border-border pb-4">
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary" />
                    <span>AI Промпты & Скиллы для разработки расширений Zerf</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Готовые системные инструкции для Cursor, GitHub Copilot, ChatGPT и моделей BYOK
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {AI_PROMPTS_COLLECTION.map(item => {
                    const isSelected = selectedPromptId === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedPromptId(item.id)}
                        className={cn(
                          'p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-2',
                          isSelected ? 'bg-primary/10 border-primary shadow-md' : 'bg-muted/30 border-border hover:bg-muted/60'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xl">{item.icon}</span>
                          <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold text-muted-foreground">{item.badge}</span>
                        </div>
                        <h4 className="font-bold text-xs text-foreground">{item.title}</h4>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{item.shortDesc}</p>
                      </button>
                    )
                  })}
                </div>

                {/* Prompt Text Viewer */}
                {(() => {
                  const currentPrompt = AI_PROMPTS_COLLECTION.find(p => p.id === selectedPromptId) || AI_PROMPTS_COLLECTION[0]
                  return (
                    <div className="p-5 rounded-2xl bg-zinc-950 border border-border/80 space-y-3">
                      <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs">
                        <span className="font-bold text-emerald-400 font-mono">{currentPrompt.title}</span>
                        <button
                          onClick={() => copyToClipboard(currentPrompt.prompt, 'ai_prompt_copy')}
                          className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {copiedId === 'ai_prompt_copy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === 'ai_prompt_copy' ? 'Скопировано!' : 'Копировать'}</span>
                        </button>
                      </div>

                      <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed max-h-[350px] overflow-y-auto">
                        {currentPrompt.prompt}
                      </pre>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIEW 7: SDK DOCS (REFERENCE)
          ══════════════════════════════════════════════════════════════ */}
          {navSection === 'sdk_docs' && (
            <div className="space-y-6 max-w-5xl">
              <div className="p-6 md:p-8 rounded-3xl bg-card border border-border shadow-xs space-y-6 text-xs">
                <div className="border-b border-border pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
                      <BookOpen className="w-5 h-5 text-primary" />
                      <span>Полный справочник разработчика Zerf Note SDK & API</span>
                    </h2>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Официальная документация платформы: архитектура, манифест V2, API контекста ZerfContext, права доступа и интеграция с GitHub
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleDownloadStarterKit}
                      className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Скачать Starter Kit</span>
                    </button>
                  </div>
                </div>

                {/* Subtabs for SDK Docs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs border-b border-border/40 scrollbar-none">
                  {[
                    { id: 'overview', label: '📌 1. Быстрый старт & Архитектура' },
                    { id: 'manifest', label: '📄 2. Спецификация Manifest V2' },
                    { id: 'context', label: '⚡ 3. ZerfContext SDK API' },
                    { id: 'github_publish', label: '🐙 4. Публикация из GitHub' },
                    { id: 'monetization', label: '💰 5. Монетизация 80/20' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setSdkDocTab(tab.id as any)}
                      className={cn(
                        'px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer shrink-0',
                        sdkDocTab === tab.id
                          ? 'bg-primary/20 text-primary border border-primary/40 shadow-xs'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* 1. Overview */}
                {sdkDocTab === 'overview' && (
                  <div className="space-y-4 leading-relaxed text-foreground/90 text-xs">
                    <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
                      <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                        <span>🏛️ Архитектура расширений Zerf Note</span>
                      </h3>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        Платформа Zerf Note позволяет создавать модульные расширения: виджеты дашборда, шаблоны, интеграции с внешними API, темы оформления и AI-скиллы.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        <div className="p-3 rounded-xl bg-card border border-border space-y-1">
                          <p className="font-bold text-foreground">1. Изолированная VM</p>
                          <p className="text-[11px] text-muted-foreground">Каждое расширение работает в безопасной песочнице с гранулярными правами доступа.</p>
                        </div>
                        <div className="p-3 rounded-xl bg-card border border-border space-y-1">
                          <p className="font-bold text-foreground">2. ZerfContext API</p>
                          <p className="text-[11px] text-muted-foreground">Прямой доступ к созданию задач, заметок, вызову ИИ и управлению окнами.</p>
                        </div>
                        <div className="p-3 rounded-xl bg-card border border-border space-y-1">
                          <p className="font-bold text-foreground">3. GitHub Репозитории</p>
                          <p className="text-[11px] text-muted-foreground">Публикация и версионирование напрямую из вашего открытого или приватного GitHub.</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
                      <p className="font-bold text-foreground">📦 Установка SDK через npm / bun / pnpm:</p>
                      <pre className="p-3.5 rounded-xl bg-zinc-950 text-emerald-400 font-mono text-xs overflow-x-auto">
npm install @zerf/sdk
# или через pnpm:
pnpm add @zerf/sdk</pre>
                    </div>
                  </div>
                )}

                {/* 2. Manifest V2 */}
                {sdkDocTab === 'manifest' && (
                  <div className="space-y-4 leading-relaxed text-foreground/90 text-xs">
                    <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
                      <h3 className="font-bold text-sm text-foreground">📄 Манифест расширения (zerf-extension.json)</h3>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        Файл манифеста располагается в корне вашего репозитория и описывает метаданные, категорию, требуемые разрешения и инструкции для ИИ.
                      </p>
                      <pre className="p-4 rounded-xl bg-zinc-950 text-primary font-mono text-xs overflow-x-auto leading-relaxed whitespace-pre-wrap">
{`{
  "$schema": "https://zeprh.vercel.app/schemas/extension-v2.json",
  "name": "zerf-plugin-my-widget",
  "title": "Умный виджет продуктивности",
  "version": "1.0.0",
  "description": "Автоматизирует рутинные задачи и выводит метрики дня",
  "author": "waters1ze",
  "category": "Продуктивность",
  "type": "widget",
  "icon": "⚡",
  "minPlan": "free",
  "price": 0,
  "permissions": [
    "tasks:read",
    "tasks:write",
    "notes:write",
    "ui:notify",
    "ai:prompt"
  ],
  "triggers": ["/widget", "покажи метрики", "статистика дня"],
  "aiInstructions": "Когда пользователь запрашивает метрики дня, сформируй красивый отчет и создай задачи по несделанным делам."
}`}
                      </pre>
                    </div>

                    <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
                      <h4 className="font-bold text-foreground">Таблица разрешений (Permissions):</h4>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="p-2 rounded-lg bg-card border border-border flex items-center justify-between">
                          <code className="text-primary font-mono font-bold">tasks:read / tasks:write</code>
                          <span className="text-muted-foreground">Чтение, создание и отметка задач в списке пользователя</span>
                        </div>
                        <div className="p-2 rounded-lg bg-card border border-border flex items-center justify-between">
                          <code className="text-primary font-mono font-bold">notes:read / notes:write</code>
                          <span className="text-muted-foreground">Работа с заметками, базой знаний и Wikilinks</span>
                        </div>
                        <div className="p-2 rounded-lg bg-card border border-border flex items-center justify-between">
                          <code className="text-primary font-mono font-bold">ai:prompt</code>
                          <span className="text-muted-foreground">Вызов встроенного ИИ Zerf Note или моделей BYOK пользователя</span>
                        </div>
                        <div className="p-2 rounded-lg bg-card border border-border flex items-center justify-between">
                          <code className="text-primary font-mono font-bold">ui:notify / ui:modal</code>
                          <span className="text-muted-foreground">Показ всплывающих тостов, звуковых алертов и модальных окон</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. ZerfContext API */}
                {sdkDocTab === 'context' && (
                  <div className="space-y-4 leading-relaxed text-foreground/90 text-xs">
                    <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
                      <h3 className="font-bold text-sm text-foreground">⚡ Глобальный объект ZerfContext API</h3>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        Внутри вашего виджета или скрипта доступен глобальный объект <code className="text-primary font-mono font-bold">ZerfContext</code>:
                      </p>
                      <pre className="p-4 rounded-xl bg-zinc-950 text-purple-200 font-mono text-xs overflow-x-auto leading-relaxed whitespace-pre-wrap">
{`// 1. Работа с задачами:
const activeTasks = await ZerfContext.tasks.getAll({ done: false })
const newTask = await ZerfContext.tasks.create({
  title: "Встреча с командой",
  priority: "high",
  dueDate: "2026-08-20T19:00:00Z"
})
await ZerfContext.tasks.complete(newTask.id)

// 2. Работа с заметками:
const note = await ZerfContext.notes.create({
  title: "Конспект исследования",
  body: "Синтез данных из расширения... [[Связанная заметка]]"
})

// 3. Вызов ИИ (Groq / OpenAI / Claude):
const aiResult = await ZerfContext.ai.prompt({
  system: "Ты ассистент продуктивности.",
  user: "Проанализируй список дел на сегодня и выдели топ-3."
})

// 4. Системные уведомления и звук:
await ZerfContext.notifications.send({
  title: "Таймер завершен!",
  body: "Время сделать 5-минутный перерыв."
})

// 5. Данные профиля:
const user = ZerfContext.user.get() // { name: "Кирилл", plan: "pro", avatar: "zerfik" }`}
                      </pre>
                    </div>
                  </div>
                )}

                {/* 4. GitHub Publish */}
                {sdkDocTab === 'github_publish' && (
                  <div className="space-y-4 leading-relaxed text-foreground/90 text-xs">
                    <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
                      <h3 className="font-bold text-sm text-foreground">🐙 Публикация расширений из GitHub в Магазин Zerf Note</h3>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        Публикация занимает меньше 1 минуты благодаря автоматической валидации через GitHub API:
                      </p>
                      <div className="space-y-2 text-xs">
                        <p>1. Создайте публичный репозиторий на GitHub (например, <code className="text-primary font-mono">github.com/yourname/zerf-plugin-timer</code>).</p>
                        <p>2. Поместите в корень репозитория файл <code className="text-primary font-mono font-bold">zerf-extension.json</code> и код виджета.</p>
                        <p>3. В Zerf Dev Studio перейдите во вкладку <b>«Публикация из GitHub»</b>, вставьте ссылку на репозиторий и нажмите <b>«Проверить и опубликовать»</b>.</p>
                        <p>4. Сервер автоматически проверит схему, создаст карточку плагина в каталоге и активирует прием платежей.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Monetization 80/20 */}
                {sdkDocTab === 'monetization' && (
                  <div className="space-y-4 leading-relaxed text-foreground/90 text-xs">
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                      <h3 className="font-bold text-sm text-emerald-400">💰 Монетизация плагинов (80% доход автора)</h3>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        Вы можете устанавливать любую цену за ваши расширения (например, 199 ₽, 490 ₽ или бесплатно).
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-xs text-foreground/90">
                        <li><b>80% с каждой продажи</b> автоматически поступает на ваш баланс автора.</li>
                        <li>Выплаты производятся на привязанный кошелёк <b>ЮMoney</b> или банковские карты РФ.</li>
                        <li>Статистика продаж и начислений обновляется в реальном времени во вкладке <b>«Баланс автора»</b>.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIEW 8: ZERF CLI TERMINAL & TOOLS
          ══════════════════════════════════════════════════════════════ */}
          {navSection === 'cli_tools' && (
            <div className="space-y-6 max-w-5xl">
              {/* Header */}
              <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-900/30 via-primary/15 to-transparent border border-emerald-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-emerald-400" />
                    <span>Zerf CLI — Командная строка & Терминал разработчика</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Создавайте, локально тестируйте и публикуйте расширения прямо из вашей консоли или интерактивного терминала
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-semibold">
                    v2.6.0-stable
                  </span>
                </div>
              </div>

              {/* Interactive Terminal Emulator */}
              <div className="p-6 rounded-3xl bg-zinc-950 border border-border/80 shadow-xl space-y-4 font-mono text-xs">
                
                {/* Terminal Window Header Bar */}
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                    <span className="text-[11px] text-zinc-400 ml-2 font-sans font-semibold">zerf-studio-cli ~ bash — 80x24</span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-sans">
                    <button
                      onClick={() => setCliLogs([])}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Очистить
                    </button>
                  </div>
                </div>

                {/* Quick Action Chips */}
                <div className="flex items-center gap-1.5 flex-wrap font-sans text-xs pt-1">
                  <span className="text-[11px] text-zinc-400 font-semibold">Быстрые команды:</span>
                  {[
                    'zerf init my-agent',
                    'zerf dev --port 3000',
                    'zerf test',
                    'zerf login',
                    'zerf publish',
                    'zerf --help'
                  ].map(cmd => (
                    <button
                      key={cmd}
                      onClick={() => handleRunCliCommand(cmd)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono transition-all cursor-pointer"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>

                {/* Terminal Output Stream */}
                <div className="space-y-3 min-h-[220px] max-h-[380px] overflow-y-auto pr-1">
                  {cliLogs.map(log => (
                    <div key={log.id} className="space-y-1">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <span className="text-emerald-400 font-bold">developer@zerf-studio:~$</span>
                        <span className="text-white font-bold">{log.command}</span>
                        <span className="text-zinc-600 text-[10px]">[{log.time}]</span>
                      </div>
                      <pre className={cn(
                        'p-2.5 rounded-xl bg-black/40 border border-white/5 whitespace-pre-wrap leading-relaxed text-[11px]',
                        log.status === 'ok' ? 'text-emerald-400' : log.status === 'err' ? 'text-rose-400' : 'text-cyan-300'
                      )}>
                        {log.output}
                      </pre>
                    </div>
                  ))}
                </div>

                {/* Terminal Interactive Input */}
                <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                  <span className="text-emerald-400 font-bold shrink-0">developer@zerf-studio:~$</span>
                  <input
                    type="text"
                    value={cliCommandInput}
                    onChange={e => setCliCommandInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRunCliCommand()}
                    placeholder="Введите команду (например: zerf init my-plugin) и нажмите Enter..."
                    className="flex-1 bg-transparent text-white font-mono text-xs outline-none"
                  />
                  <button
                    onClick={() => handleRunCliCommand()}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold font-sans text-xs transition-all cursor-pointer"
                  >
                    Выполнить
                  </button>
                </div>
              </div>

              {/* CLI Command Reference Table */}
              <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-4 text-xs">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2 border-b border-border pb-3">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span>Справочник команд Zerf CLI</span>
                </h3>

                <div className="space-y-2">
                  <div className="p-3.5 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <code className="text-primary font-mono font-bold text-xs">npx zerf-cli init [name]</code>
                      <p className="text-muted-foreground text-[11px] mt-0.5">Создает готовый репозиторий расширения с шаблоном манифеста и типами TypeScript</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground font-mono shrink-0">--template=widget</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <code className="text-primary font-mono font-bold text-xs">npx zerf-cli dev [--port 3000]</code>
                      <p className="text-muted-foreground text-[11px] mt-0.5">Локальный сервер разработки с горячей перезагрузкой и симуляцией ZerfContext API</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground font-mono shrink-0">Live Reload</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <code className="text-primary font-mono font-bold text-xs">npx zerf-cli test</code>
                      <p className="text-muted-foreground text-[11px] mt-0.5">Строгая валидация манифеста JSON Schema V2 и запуск тестов расширения</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground font-mono shrink-0">Schema Validator</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <code className="text-primary font-mono font-bold text-xs">npx zerf-cli publish</code>
                      <p className="text-muted-foreground text-[11px] mt-0.5">Сборка бандла и мгновенный деплой новой версии расширения в Каталог Zerf Note</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-mono text-[10px] shrink-0">Release</span>
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
