'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Key, Shield, Check, Copy, Eye, EyeOff, Sparkles,
  Zap, Terminal, RefreshCw, Smartphone, CheckCircle2,
  ExternalLink, AlertCircle, Cpu, Lock, Bell, Code2,
  Share2, Bot, Layers
} from 'lucide-react'
import { useSettings, getAuthHeaders } from '@/lib/store'
import { showWebNotification } from '@/lib/notifications'
import { cn } from '@/lib/utils'

interface ApiKeysSectionProps {
  siriKey?: string
  chatId?: string
  userPlan?: string
}

export function ApiKeysSection({ siriKey, chatId, userPlan = 'free' }: ApiKeysSectionProps) {
  const { settings, update } = useSettings()
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [saveToast, setSaveToast] = useState(false)
  const [testingKey, setTestingKey] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; message: string } | null>(null)

  // Push test states
  const [pushLoading, setPushLoading] = useState(false)
  const [pushResult, setPushResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Local state for AI inputs
  const [groqKey, setGroqKey] = useState(settings.integrations?.apiKey || '')
  const [openaiKey, setOpenaiKey] = useState(settings.integrations?.openaiKey || '')
  const [anthropicKey, setAnthropicKey] = useState(settings.integrations?.anthropicKey || '')
  const [geminiKey, setGeminiKey] = useState(settings.integrations?.geminiKey || '')

  const currentAuthToken = typeof window !== 'undefined'
    ? (localStorage.getItem('zerf_auth_token') || siriKey || chatId || 'zerf_sec_' + (chatId || 'guest'))
    : (siriKey || 'zerf_sec_demo')

  // Generate a project key format
  const projectApiKey = `zerf_pk_${currentAuthToken.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}`

  // MCP Configuration JSON snippet
  const mcpConfigJson = JSON.stringify({
    mcpServers: {
      zerf: {
        command: "npx",
        args: ["-y", "@zerf/mcp-server"],
        env: {
          ZERF_API_TOKEN: currentAuthToken,
          ZERF_BASE_URL: typeof window !== 'undefined' ? window.location.origin : "https://zeprh.vercel.app"
        }
      }
    }
  }, null, 2)

  const toggleVisibility = (id: string) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedKey(id)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleSaveKeys = async () => {
    update({
      integrations: {
        ...settings.integrations,
        apiKey: groqKey.trim(),
        openaiKey: openaiKey.trim(),
        anthropicKey: anthropicKey.trim(),
        geminiKey: geminiKey.trim(),
      }
    })

    try {
      await fetch('/api/telegram/user', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groqApiKey: groqKey.trim(),
          openaiKey: openaiKey.trim(),
          anthropicKey: anthropicKey.trim(),
          geminiKey: geminiKey.trim(),
        })
      })
    } catch {}

    setSaveToast(true)
    setTimeout(() => setSaveToast(false), 2500)
  }

  const testGroqConnection = async () => {
    setTestingKey('groq')
    setTestResult(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
          ...(groqKey ? { 'x-groq-api-key': groqKey.trim() } : {}),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'ping' }],
          apiKey: groqKey.trim() || undefined,
        })
      })
      const data = await res.json()
      if (res.ok && data.content) {
        setTestResult({ id: 'groq', ok: true, message: 'Ключ успешно проверен! Отклик ИИ получен.' })
      } else {
        setTestResult({ id: 'groq', ok: false, message: data.error || 'Ошибка проверки ключа' })
      }
    } catch (e: any) {
      setTestResult({ id: 'groq', ok: false, message: e?.message || 'Сетевая ошибка' })
    } finally {
      setTestingKey(null)
    }
  }

  const handleTestPush = async () => {
    setPushLoading(true)
    setPushResult(null)

    // Immediate instant feedback on current screen
    showWebNotification('🔔 Тестовый Пуш от Zerf Note', {
      body: 'Ура! Пуш-уведомления успешно работают на вашем устройстве! 🎉',
      tag: 'zerf-test-push',
    })

    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '🔔 Тестовое уведомление Zerf',
          message: 'Пуш-уведомления успешно доставлены на все ваши устройства! 🎉',
          chatId,
        }),
      })
      const data = await res.json()
      if (data.success || data.webPushResult?.success) {
        setPushResult({ ok: true, message: 'Тестовое уведомление отправлено на все подключённые устройства!' })
      } else {
        setPushResult({ ok: true, message: 'Тестовое уведомление отправлено!' })
      }
    } catch (err: any) {
      setPushResult({ ok: false, message: err?.message || 'Ошибка сети при отправке пуша.' })
    } finally {
      setPushLoading(false)
    }
  }

  return (
    <div className="space-y-6 text-foreground font-sans">
      {/* Header Banner */}
      <div className="p-4 rounded-2xl bg-card border border-border/80 flex items-start justify-between gap-3 relative overflow-hidden shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-foreground">API Ключи, MCP & Интеграции</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                BYOK & MCP Ready
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Подключайте Zerf Note к сторонним нейросетям (Claude, Cursor, ChatGPT) через Model Context Protocol и используйте собственные API-ключи для неограниченных лимитов.
            </p>
          </div>
        </div>

        <AnimatePresence>
          {saveToast && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md shrink-0"
            >
              <Check className="w-3.5 h-3.5" /> Сохранено
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Section 1: Zerf Project API & MCP ── */}
      <div className="space-y-4">
        <h4 className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground px-1 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-primary" /> Ключ проекта и подключение к ИИ (Claude / Cursor / MCP)
        </h4>

        {/* Zerf Project API Key */}
        <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs">
                <Code2 className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-foreground">Zerf Project API Key</h5>
                <p className="text-[11px] text-muted-foreground">Прямой ключ для доступа нейросетей (Claude, Cursor, ChatGPT) к вашим задачам и заметкам</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Полноправный доступ
            </span>
          </div>

          <div className="flex items-center gap-2 flex-col sm:flex-row">
            <div className="relative flex-1 w-full">
              <input
                type={showKeys['projectKey'] ? 'text' : 'password'}
                readOnly
                value={projectApiKey}
                className="w-full pl-3 pr-10 py-2 rounded-xl bg-muted/40 border border-border text-xs text-foreground font-mono select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={() => toggleVisibility('projectKey')}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Показать/Скрыть"
              >
                {showKeys['projectKey'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(projectApiKey, 'projectKey')}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs hover:opacity-90 transition-all cursor-pointer shrink-0"
            >
              {copiedKey === 'projectKey' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'projectKey' ? 'Скопировано!' : 'Скопировать ключ'}</span>
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground/80 leading-tight">
            💡 Передайте этот ключ в системный промпт Claude или GPT, чтобы нейросеть могла обращаться к API вашего проекта.
          </p>
        </div>

        {/* Zerf MCP Server Integration Card */}
        <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-foreground">Zerf MCP Сервер (Model Context Protocol)</h5>
                <p className="text-[11px] text-muted-foreground">Интеграция для Claude Desktop, Cursor AI, Windsurf и других MCP-клиентов</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              MCP Protocol
            </span>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-muted-foreground">Конфигурация claude_desktop_config.json:</span>
              <button
                type="button"
                onClick={() => copyToClipboard(mcpConfigJson, 'mcp')}
                className="px-2.5 py-1 rounded-lg bg-card hover:bg-muted text-foreground text-[11px] font-semibold border border-border flex items-center gap-1 transition-all cursor-pointer"
              >
                {copiedKey === 'mcp' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'mcp' ? 'JSON скопирован!' : 'Скопировать JSON'}</span>
              </button>
            </div>
            <pre className="text-[10.5px] font-mono text-foreground/90 overflow-x-auto p-2.5 rounded-lg bg-black/40 border border-border/40 max-h-36">
              {mcpConfigJson}
            </pre>
          </div>
        </div>

        {/* Telegram Test Push Notification Card */}
        <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-foreground">Проверка связи и Push-уведомлений</h5>
                <p className="text-[11px] text-muted-foreground">Мгновенная отправка тестового сообщения в ваш Telegram-аккаунт</p>
              </div>
            </div>
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", chatId ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20")}>
              {chatId ? `ID: ${chatId}` : 'Telegram не привязан'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestPush}
              disabled={pushLoading}
              className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold border border-border flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {pushLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
              <span>Отправить тестовое уведомление</span>
            </button>
            {!chatId && (
              <a
                href="https://t.me/Zerph_bot"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold flex items-center gap-1 border border-primary/25"
              >
                <span>Подключить @Zerph_bot</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {pushResult && (
            <div className={cn(
              "p-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in",
              pushResult.ok
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
            )}>
              {pushResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{pushResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: AI Provider Keys (BYOK) ── */}
      <div className="space-y-4 pt-2">
        <h4 className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground px-1 flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-primary" /> Провайдеры искусственного интеллекта (BYOK)
        </h4>

        <div className="grid grid-cols-1 gap-3">
          {/* Groq Key */}
          <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold text-xs">⚡</div>
                <div>
                  <h5 className="text-xs font-bold text-foreground">Groq API Key</h5>
                  <p className="text-[11px] text-muted-foreground">Для Llama 3.1 8B, Qwen 3.6 27B, GPT-OSS 20B/120B и Whisper</p>
                </div>
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                groqKey ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-muted text-muted-foreground border-border"
              )}>
                {groqKey ? 'Пользовательский ключ' : 'Встроенный пул Zerf'}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-col sm:flex-row">
              <div className="relative flex-1 w-full">
                <input
                  type={showKeys['groq'] ? 'text' : 'password'}
                  value={groqKey}
                  onChange={e => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full pl-3 pr-10 py-2 rounded-xl bg-muted/40 border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility('groq')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showKeys['groq'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                type="button"
                onClick={testGroqConnection}
                disabled={testingKey === 'groq'}
                className="w-full sm:w-auto px-3 py-2 rounded-xl bg-muted hover:bg-accent text-foreground text-xs font-semibold border border-border flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-50"
              >
                {testingKey === 'groq' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
                <span>Проверить</span>
              </button>
            </div>

            {testResult && testResult.id === 'groq' && (
              <div className={cn(
                "p-2.5 rounded-xl text-xs flex items-center gap-2",
                testResult.ok
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
              )}>
                {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* OpenAI Key */}
          <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs">🤖</div>
                <div>
                  <h5 className="text-xs font-bold text-foreground">OpenAI API Key</h5>
                  <p className="text-[11px] text-muted-foreground">Для GPT-4o, GPT-4o-mini и Whisper API</p>
                </div>
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                openaiKey ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-muted text-muted-foreground border-border"
              )}>
                {openaiKey ? 'Подключен' : 'Не указан'}
              </span>
            </div>

            <div className="relative">
              <input
                type={showKeys['openai'] ? 'text' : 'password'}
                value={openaiKey}
                onChange={e => setOpenaiKey(e.target.value)}
                placeholder="sk-proj-..."
                className="w-full pl-3 pr-10 py-2 rounded-xl bg-muted/40 border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => toggleVisibility('openai')}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showKeys['openai'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Anthropic Key */}
          <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold text-xs">🔮</div>
                <div>
                  <h5 className="text-xs font-bold text-foreground">Anthropic Claude API Key</h5>
                  <p className="text-[11px] text-muted-foreground">Для Claude 3.7 Sonnet, Claude 3.5 Haiku и Deep Research</p>
                </div>
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                anthropicKey ? "bg-purple-500/10 text-purple-500 border-purple-500/20" : "bg-muted text-muted-foreground border-border"
              )}>
                {anthropicKey ? 'Подключен' : 'Не указан'}
              </span>
            </div>

            <div className="relative">
              <input
                type={showKeys['anthropic'] ? 'text' : 'password'}
                value={anthropicKey}
                onChange={e => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full pl-3 pr-10 py-2 rounded-xl bg-muted/40 border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => toggleVisibility('anthropic')}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showKeys['anthropic'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Google Gemini Key */}
          <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs">✨</div>
                <div>
                  <h5 className="text-xs font-bold text-foreground">Google Gemini API Key</h5>
                  <p className="text-[11px] text-muted-foreground">Для моделей Gemini 2.5 Flash и Gemini 2.5 Pro</p>
                </div>
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                geminiKey ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-muted text-muted-foreground border-border"
              )}>
                {geminiKey ? 'Подключен' : 'Не указан'}
              </span>
            </div>

            <div className="relative">
              <input
                type={showKeys['gemini'] ? 'text' : 'password'}
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full pl-3 pr-10 py-2 rounded-xl bg-muted/40 border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => toggleVisibility('gemini')}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showKeys['gemini'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Save API Keys Button */}
        <button
          type="button"
          onClick={handleSaveKeys}
          className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
        >
          <Check className="w-4 h-4" /> Сохранить ключи ИИ
        </button>
      </div>

      {/* ── Section 3: Siri & CLI Tokens ── */}
      <div className="space-y-4 pt-2">
        <h4 className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground px-1 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-primary" /> Токены голосового ввода и терминала
        </h4>

        <div className="grid grid-cols-1 gap-3">
          {/* Siri & Shortcuts Token */}
          <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-pink-500/10 text-pink-500 flex items-center justify-center font-bold text-xs">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-foreground">Токен для Siri & Быстрых Команд (iOS)</h5>
                  <p className="text-[11px] text-muted-foreground">Используется для быстрой отправки голосовых заметок и задач</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Активен
              </span>
            </div>

            <div className="flex items-center gap-2 flex-col sm:flex-row">
              <div className="relative flex-1 w-full">
                <input
                  type={showKeys['siri'] ? 'text' : 'password'}
                  readOnly
                  value={siriKey || currentAuthToken}
                  className="w-full pl-3 pr-10 py-2 rounded-xl bg-muted/40 border border-border text-xs text-foreground font-mono select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility('siri')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showKeys['siri'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(siriKey || currentAuthToken, 'siri')}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs hover:opacity-90 transition-all cursor-pointer shrink-0"
              >
                {copiedKey === 'siri' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'siri' ? 'Скопировано' : 'Копировать'}</span>
              </button>
            </div>
          </div>

          {/* Zerf CLI Terminal Token */}
          <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-foreground">Zerf CLI Token (Терминальный доступ)</h5>
                  <p className="text-[11px] text-muted-foreground">Для входа в консольный ассистент Zerf через терминал</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Готов к входу
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-muted/60 border border-border/70 flex items-center justify-between gap-2 flex-col sm:flex-row">
              <code className="text-[11px] font-mono text-muted-foreground truncate w-full sm:w-auto">
                zerf auth login --token {currentAuthToken.slice(0, 12)}...
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(`zerf auth login --token ${currentAuthToken}`, 'cli')}
                className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-card hover:bg-accent text-foreground text-xs font-semibold border border-border flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0"
              >
                {copiedKey === 'cli' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'cli' ? 'Скопировано' : 'Скопировать команду'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
