'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Brain, Sparkles, Lock, Check, Zap, MessageSquare, ListTodo, Target, RotateCcw, BarChart2, Mic, Crown, Cpu, Terminal, Key, Eye, EyeOff, ExternalLink, Puzzle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettings, getAuthHeaders } from '@/lib/store'
import { PlanId } from '@/lib/plans'

interface AiModelsSectionProps {
  userPlan: PlanId
  onUpgradeClick?: () => void
}

const ALL_MODELS = [
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B Flagship', tier: 'pro', params: '120B', desc: 'Флагманский максимальный интеллект (500 T/s, 131K контекст) для масштабных проектов и сложной логики' },
  { id: 'qwen/qwen3.6-27b', name: 'Qwen 3.6 27B', tier: 'plus', params: '27B', desc: 'Продвинутая логика, структурирование задач и анализ расписания (500 T/s, 131K контекст)' },
  { id: 'groq/compound-mini', name: 'Groq Compound Mini (20B)', tier: 'free', params: '20B', desc: 'Компактная сверхбыстрая 20B система оркестрации инструментов (450 T/s, 131K контекст)' },
  { id: 'groq/compound', name: 'Groq Compound System', tier: 'free', params: '70B', desc: 'Комплексная система с авто-роутингом и оркестрацией инструментов (450 T/s)' },
  { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B Fast', tier: 'free', params: '20B', desc: 'Сверхбыстрый отклик (1000 T/s, 131K контекст), чистый русский язык, мгновенная обработка заметок и Siri' },
]

export function AiModelsSection({ userPlan, onUpgradeClick }: AiModelsSectionProps) {
  const { settings, update } = useSettings()
  const isCorp = (userPlan as string) === 'corp' || (userPlan as string) === 'admin' || (userPlan as string) === 'creator'
  const isProOrCorp = isCorp || userPlan === 'pro'
  const isPlus = userPlan === 'plus'
  const isFree = userPlan === 'free'

  const [modelsList, setModelsList] = useState(() => ALL_MODELS)

  const processModelsData = React.useCallback((rawModels: any[]) => {
    if (!Array.isArray(rawModels) || rawModels.length === 0) return
    const chatOnly = rawModels.filter((m: any) => 
      !m.id.toLowerCase().includes('guard') &&
      !m.id.toLowerCase().includes('safeguard') &&
      !m.id.toLowerCase().includes('orpheus') &&
      !m.id.toLowerCase().includes('arabic') &&
      !m.id.toLowerCase().includes('allam')
    )
    if (chatOnly.length > 0) {
      setModelsList(chatOnly.map((m: any) => ({
        id: m.id,
        name: m.name,
        tier: m.minTier,
        params: m.paramsBillions ? (m.paramsBillions >= 1 ? `${m.paramsBillions}B` : `${Math.round(m.paramsBillions * 1000)}M`) : 'Auto',
        desc: m.desc || '',
      })))
    }
  }, [])

  React.useEffect(() => {
    let isMounted = true
    fetch('/api/ai/models')
      .then(r => r.json())
      .then(d => {
        if (isMounted && Array.isArray(d.models)) {
          processModelsData(d.models)
        }
      })
      .catch(() => {})

    const handleRealtimeUpdate = (e: any) => {
      if (isMounted && e.detail) {
        processModelsData(e.detail)
      }
    }
    window.addEventListener('zerf_ai_models_updated', handleRealtimeUpdate)

    return () => {
      isMounted = false
      window.removeEventListener('zerf_ai_models_updated', handleRealtimeUpdate)
    }
  }, [processModelsData])

  const availableModelsForPlan = modelsList.filter(m => {
    if (isCorp) return true
    if (isProOrCorp) return m.tier === 'pro' || m.tier === 'plus' || m.tier === 'free'
    if (isPlus) return m.tier === 'plus' || m.tier === 'free'
    return m.tier === 'free'
  })

  const currentGlobalModel = settings.integrations?.aiModel || (isProOrCorp ? 'openai/gpt-oss-120b' : isPlus ? 'qwen/qwen3.6-27b' : 'groq/compound')
  const taskModels = settings.integrations?.aiTaskModels || {}

  const [savedToast, setSavedToast] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  const showSaved = () => {
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2000)
  }

  const syncToBackend = async (payload: { aiModel?: string; aiTaskModels?: Record<string, string>; siriMode?: string }) => {
    try {
      await fetch('/api/telegram/user', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {}
  }

  const handleGlobalModelChange = (modelId: string) => {
    const selectedMeta = modelsList.find(m => m.id === modelId)
    if (!selectedMeta) return

    if (isFree && selectedMeta.tier !== 'free') {
      if (onUpgradeClick) onUpgradeClick()
      return
    }
    if (isPlus && (selectedMeta.tier === 'pro' || selectedMeta.tier === 'corp')) {
      if (onUpgradeClick) onUpgradeClick()
      return
    }
    if (userPlan === 'pro' && selectedMeta.tier === 'corp') {
      if (onUpgradeClick) onUpgradeClick()
      return
    }

    update({
      integrations: {
        ...settings.integrations,
        aiModel: modelId,
      }
    })
    syncToBackend({ aiModel: modelId })
    showSaved()
  }

  const handleTaskModelChange = (taskKey: 'chat' | 'parser' | 'goals' | 'reschedule' | 'analytics' | 'siri' | 'extensions', modelId: string) => {
    if (!isProOrCorp && !isPlus) {
      if (onUpgradeClick) onUpgradeClick()
      return
    }

    const selectedMeta = modelsList.find(m => m.id === modelId)
    if (isPlus && (selectedMeta?.tier === 'pro' || selectedMeta?.tier === 'corp')) {
      if (onUpgradeClick) onUpgradeClick()
      return
    }
    if (userPlan === 'pro' && selectedMeta?.tier === 'corp') {
      if (onUpgradeClick) onUpgradeClick()
      return
    }

    const nextTaskModels = {
      ...taskModels,
      [taskKey]: modelId,
    }
    update({
      integrations: {
        ...settings.integrations,
        aiTaskModels: nextTaskModels,
      }
    })
    syncToBackend({ aiTaskModels: nextTaskModels })
    showSaved()
  }

  const fastModelsForSiri = React.useMemo(() => {
    const filtered = availableModelsForPlan.filter(m => {
      const id = m.id.toLowerCase()
      return (
        id.includes('20b') ||
        id.includes('compound-mini') ||
        id.includes('27b') ||
        id.includes('8b') ||
        id.includes('7b') ||
        id.includes('mini') ||
        id.includes('fast')
      )
    })
    return filtered.length > 0 ? filtered : availableModelsForPlan
  }, [availableModelsForPlan])

  return (
    <div className="space-y-6">
      {/* Tier AI Header Badge */}
      <div className="p-4 rounded-2xl bg-card border border-border/80 flex items-start gap-3 relative overflow-hidden">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
          isProOrCorp ? "bg-amber-500/15 text-amber-500" : isPlus ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        )}>
          {isProOrCorp ? <Crown className="w-5 h-5" /> : <Brain className="w-5 h-5" />}
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-foreground">
              {isProOrCorp ? '👑 Режим Pro & Corp: Флагманы до 120B и Enterprise' : isPlus ? '⚡ Режим Plus: Нейросети до 70B' : '🆓 Бесплатный тариф: Groq Compound, Compound Mini и до 20B'}
            </h4>
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
              isProOrCorp ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30" : isPlus ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground"
            )}>
              {userPlan}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isProOrCorp
              ? 'Вам доступен выбор любых флагманских нейросетей (GPT-OSS 120B Flagship, Qwen 3.6 27B, Groq Compound), максимальный приоритет и оркестрация инструментов.'
              : isPlus
              ? 'Вам доступен выбор моделей уровня Plus (Qwen 3.6 27B, Groq Compound 70B, GPT-OSS 20B). Оформите Pro для доступа к флагману 120B!'
              : 'На бесплатном тарифе доступны быстрые системы Groq Compound, Compound Mini и GPT-OSS 20B.'}
          </p>
        </div>
        {savedToast && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-4 right-4 bg-emerald-500 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md"
          >
            <Check className="w-3.5 h-3.5" /> Сохранено
          </motion.div>
        )}
      </div>

      {/* Voice Transcription Info */}
      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">Голосовое распознавание (Whisper Turbo)</p>
            <p className="text-[11px] text-muted-foreground">Используется самая быстрая и экономичная модель транскрипции</p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
          Активно
        </span>
      </div>

      {/* Mode 1: Free & Plus Single Global Model Selector */}
      {(!isProOrCorp && !isPlus) && (
        <div className="space-y-3">
          <h4 className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground px-1">
            Выбор основной ИИ-модели для задач и чата
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Llama 3.1 8B Instant (Free) */}
            <button
              type="button"
              onClick={() => handleGlobalModelChange('llama-3.1-8b-instant')}
              className={cn(
                "p-3.5 rounded-2xl border text-left flex flex-col justify-between space-y-2 transition-all cursor-pointer",
                currentGlobalModel === 'llama-3.1-8b-instant'
                  ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40"
                  : "border-border bg-card hover:border-border/80 hover:bg-accent/40"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Llama 3.1 8B Instant</span>
                {currentGlobalModel === 'llama-3.1-8b-instant' && (
                  <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Легковесная и быстрая модель для базового ввода заметок и команд</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground w-fit">8 млрд параметров</span>
            </button>

            {/* Groq Compound Mini (Free) */}
            <button
              type="button"
              onClick={() => handleGlobalModelChange('groq/compound-mini')}
              className={cn(
                "p-3.5 rounded-2xl border text-left flex flex-col justify-between space-y-2 transition-all cursor-pointer",
                currentGlobalModel === 'groq/compound-mini'
                  ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40"
                  : "border-border bg-card hover:border-border/80 hover:bg-accent/40"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Groq Compound Mini</span>
                {currentGlobalModel === 'groq/compound-mini' && (
                  <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Компактная оптимизированная нейросеть для быстрых задач</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground w-fit">Легковесная</span>
            </button>
          </div>
        </div>
      )}

      {/* Per-Task Customization for Pro, Corp & Plus */}
      {(isProOrCorp || isPlus) ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
              Индивидуальная настройка нейросетей по типам задач
            </h4>
            <span className={cn(
              "text-[10px] font-bold flex items-center gap-1",
              isProOrCorp ? "text-amber-500" : "text-primary"
            )}>
              <Sparkles className="w-3 h-3" /> {isProOrCorp ? 'Без ограничений' : 'Тариф Plus (до 27B)'}
            </span>
          </div>

          <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
            {/* 1. AI Chat */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">ИИ-чат и ассистент</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Ответы в чате, поддержка диалога и генерация идей</p>
              </div>
              <select
                value={taskModels.chat || currentGlobalModel}
                onChange={(e) => handleTaskModelChange('chat', e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[220px]"
              >
                {availableModelsForPlan.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.params})</option>
                ))}
              </select>
            </div>

            {/* 2. Task & Note Parser */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-foreground">Парсер заметок и задач</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Извлечение дат, приоритетов, напоминаний и тегов из голоса и текста</p>
              </div>
              <select
                value={taskModels.parser || currentGlobalModel}
                onChange={(e) => handleTaskModelChange('parser', e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[220px]"
              >
                {availableModelsForPlan.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.params})</option>
                ))}
              </select>
            </div>

            {/* 3. Goal Planner & Decomposition */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-foreground">Декомпозиция целей и проектов</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Разбиение глобальной цели на спринты, этапы и чек-листы</p>
              </div>
              <select
                value={taskModels.goals || currentGlobalModel}
                onChange={(e) => handleTaskModelChange('goals', e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[220px]"
              >
                {availableModelsForPlan.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.params})</option>
                ))}
              </select>
            </div>

            {/* 4. Smart Reschedule */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-bold text-foreground">Smart Reschedule (Перепланирование)</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Автоматическая оптимизация расписания дня при задержках</p>
              </div>
              <select
                value={taskModels.reschedule || currentGlobalModel}
                onChange={(e) => handleTaskModelChange('reschedule', e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[220px]"
              >
                {availableModelsForPlan.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.params})</option>
                ))}
              </select>
            </div>

            {/* 5. Analytics */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-bold text-foreground">AI-аналитика продуктивности</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Еженедельные отчеты, выявление прокрастинации и советы</p>
              </div>
              <select
                value={taskModels.analytics || currentGlobalModel}
                onChange={(e) => handleTaskModelChange('analytics', e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[220px]"
              >
                {availableModelsForPlan.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.params})</option>
                ))}
              </select>
            </div>

            {/* 6. Siri & Voice Shortcuts */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">Siri & Action Button (Быстрые команды)</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                    ⚡ Сверхбыстрая
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">Только скоростные модели (до 1000 T/s) для моментального отклика Siri и голосовых виджетов без задержек</p>
              </div>
              <select
                value={taskModels.siri || 'openai/gpt-oss-20b'}
                onChange={(e) => handleTaskModelChange('siri' as any, e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-background border border-primary/40 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[220px]"
              >
                {fastModelsForSiri.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.params}) — ⚡ Быстрая</option>
                ))}
              </select>
            </div>

            {/* 7. Extensions & Custom Plugins AI Core */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-500/5">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Puzzle className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-foreground">ИИ-ядро расширений и плагинов</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20">
                    Расширения
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Нейросеть для обработки команд, инструкций и генерации контента в установленных расширениях и виджетах
                </p>
              </div>
              <select
                value={taskModels.extensions || (isPlus ? 'qwen/qwen3.6-27b' : currentGlobalModel)}
                onChange={(e) => handleTaskModelChange('extensions', e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-background border border-purple-500/40 text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer max-w-[220px]"
              >
                {availableModelsForPlan.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.params})</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : (
        /* Locked Pro Preview for Free/Plus */
        <div className="p-4 rounded-2xl border border-dashed border-border bg-muted/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-foreground">Тонкая настройка моделей по задачам</span>
            </div>
            <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              Тариф Pro
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            В тарифе Pro и Corp вы сможете закрепить отдельную флагманскую модель (GPT-OSS 120B, Qwen 72B, GPT-OSS 20B) за каждым типом задач: чат, парсинг, Siri, цели, перепланирование и аналитика.
          </p>
          <button
            type="button"
            onClick={onUpgradeClick}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" /> Оформить Pro (299 ₽)
          </button>
        </div>
      )}

      {/* Siri Engine Mode Selector (Fast vs Full Intent) */}
      <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs font-bold text-foreground">Режим распознавания Siri и голосовых шорткатов</h4>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            {settings.integrations?.siriMode === 'full' ? '🧠 Полный контекст' : '⚡ Сверхбыстрый'}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Выберите, как Siri должна обрабатывать ваши задачи: мгновенно за 200 мс (компактный парсер) или с детальным анализом всей базы заметок и генерацией подзадач.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              update({
                integrations: {
                  ...settings.integrations,
                  siriMode: 'fast',
                }
              })
              syncToBackend({ siriMode: 'fast' })
              showSaved()
            }}
            className={cn(
              "p-3 rounded-xl border text-left flex flex-col justify-between space-y-1.5 transition-all cursor-pointer",
              (settings.integrations?.siriMode !== 'full')
                ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                : "border-border bg-card hover:bg-accent/40"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                ⚡ Сверхбыстрый (~150–250 мс)
              </span>
              {settings.integrations?.siriMode !== 'full' && (
                <span className="w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="w-2 h-2" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Компактный 100-токеновый промпт, мгновенный отклик, 0 задержек и отсутствие лимитов TPM. Рекомендуется.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              update({
                integrations: {
                  ...settings.integrations,
                  siriMode: 'full',
                }
              })
              syncToBackend({ siriMode: 'full' })
              showSaved()
            }}
            className={cn(
              "p-3 rounded-xl border text-left flex flex-col justify-between space-y-1.5 transition-all cursor-pointer",
              settings.integrations?.siriMode === 'full'
                ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                : "border-border bg-card hover:bg-accent/40"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                🧠 Полный контекстный
              </span>
              {settings.integrations?.siriMode === 'full' && (
                <span className="w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="w-2 h-2" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Загружает всю базу проектов и заметок, генерирует расширенные подзадачи и мотивацию к каждой задаче.
            </p>
          </button>
        </div>
      </div>

      {/* Custom AI Neural Network via API & Local CLI (Pro & Corp) */}
      <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                <span>Подключение собственной нейросети по API & Local CLI</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  Pro / Corp
                </span>
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Подключайте свои API-ключи нейросетей (OpenAI, Claude, Gemini, Ollama, Groq) и управляйте платформой из терминала
              </p>
            </div>
          </div>

          {isProOrCorp ? (
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(settings.integrations?.customAiEnabled)}
                onChange={(e) => {
                  update({
                    integrations: {
                      ...settings.integrations,
                      customAiEnabled: e.target.checked,
                    }
                  })
                  showSaved()
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          ) : (
            <button
              onClick={onUpgradeClick}
              className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-500 text-[10px] font-bold border border-amber-500/30 hover:bg-amber-500/25 transition-all cursor-pointer"
            >
              Доступно в Pro (299 ₽)
            </button>
          )}
        </div>

        {isProOrCorp && settings.integrations?.customAiEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4 pt-2 border-t border-border/60 text-xs"
          >
            {/* Quick Provider Selection */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground text-[11px] block">Провайдер или тип модели:</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'openai', label: 'OpenAI (GPT-4o)', url: 'https://api.openai.com/v1', model: 'gpt-4o' },
                  { id: 'claude', label: 'Claude (Anthropic)', url: 'https://api.anthropic.com/v1', model: 'claude-3-7-sonnet-20250219' },
                  { id: 'gemini', label: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: 'gemini-2.5-pro' },
                  { id: 'ollama', label: 'Local Ollama / LM Studio', url: 'http://localhost:11434/v1', model: 'llama3:latest' },
                  { id: 'groq', label: 'Groq Cloud', url: 'https://api.groq.com/openai/v1', model: 'deepseek-r1-distill-llama-70b' },
                  { id: 'custom', label: 'Кастомный эндпоинт', url: '', model: '' },
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      update({
                        integrations: {
                          ...settings.integrations,
                          customAiProvider: p.id,
                          customAiBaseUrl: p.url || settings.integrations?.customAiBaseUrl,
                          customAiModel: p.model || settings.integrations?.customAiModel,
                        }
                      })
                      showSaved()
                    }}
                    className={cn(
                      'p-2 rounded-xl text-left font-medium text-[11px] border transition-all cursor-pointer truncate',
                      settings.integrations?.customAiProvider === p.id
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground text-[11px] block">Ваш секретный API-ключ:</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.integrations?.customAiApiKey || ''}
                  onChange={(e) => {
                    update({
                      integrations: {
                        ...settings.integrations,
                        customAiApiKey: e.target.value,
                      }
                    })
                  }}
                  placeholder="sk-..."
                  className="w-full h-9 pl-3 pr-9 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Base URL and Model */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground text-[11px] block">Base URL (эндпоинт):</label>
                <input
                  type="text"
                  value={settings.integrations?.customAiBaseUrl || ''}
                  onChange={(e) => {
                    update({
                      integrations: {
                        ...settings.integrations,
                        customAiBaseUrl: e.target.value,
                      }
                    })
                  }}
                  placeholder="https://api.openai.com/v1"
                  className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground text-[11px] block">Имя модели (Model ID):</label>
                <input
                  type="text"
                  value={settings.integrations?.customAiModel || ''}
                  onChange={(e) => {
                    update({
                      integrations: {
                        ...settings.integrations,
                        customAiModel: e.target.value,
                      }
                    })
                  }}
                  placeholder="gpt-4o / claude-3-7-sonnet"
                  className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary font-mono text-xs"
                />
              </div>
            </div>

            {/* Local CLI Bridge Instructions */}
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-2">
              <div className="flex items-center gap-2 font-bold text-foreground text-xs">
                <Terminal className="w-3.5 h-3.5 text-primary" />
                <span>Управление и создание расширений через Local CLI</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Вы можете запускать локальные CLI-агенты, создавать расширения из командной строки и подключать автономные скрипты к вашему аккаунту Zerf Note:
              </p>
              <pre className="p-2.5 rounded-xl bg-card border border-border font-mono text-[10px] text-primary overflow-x-auto whitespace-pre-wrap">
{`# Авторизация в CLI через веб-токен:
npx zerf-cli auth --token YOUR_TOKEN

# Создание и публикация нового расширения из локального терминала:
npx zerf-cli extension init my-cool-widget
npx zerf-cli extension publish ./my-cool-widget`}
              </pre>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
