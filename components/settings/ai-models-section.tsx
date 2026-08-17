'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Brain, Sparkles, Lock, Check, Zap, MessageSquare, ListTodo, Target, RotateCcw, BarChart2, Mic, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettings } from '@/lib/store'
import { PlanId } from '@/lib/plans'

interface AiModelsSectionProps {
  userPlan: PlanId
  onUpgradeClick?: () => void
}

const ALL_MODELS = [
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B Flagship', tier: 'pro', params: '120B', desc: 'Флагманский максимальный интеллект для масштабных проектов и декомпозиции' },
  { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B Fast', tier: 'pro', params: '20B', desc: 'Сверхбыстрый отклик (~600 мс), чистый русский язык, умеренный расход' },
  { id: 'qwen/qwen3.6-27b', name: 'Qwen 3.6 27B', tier: 'plus', params: '27B', desc: 'Продвинутая логика, отличное понимание структуры дел и русского языка' },
  { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', tier: 'pro', params: '72B', desc: 'Глубокая аналитика, структурирование и планирование' },
  { id: 'groq/compound', name: 'Groq Compound', tier: 'pro', params: 'Compound', desc: 'Сбалансированная модель для быстрых вычислений' },
  { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B', tier: 'free', params: '8B', desc: 'Сверхлегкая и экономичная модель для базового ввода и быстрых команд' },
  { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen 2.5 7B', tier: 'free', params: '7B', desc: 'Компактная быстрая модель с хорошим русским языком' },
]

export function AiModelsSection({ userPlan, onUpgradeClick }: AiModelsSectionProps) {
  const { settings, update } = useSettings()
  const isProOrCorp = userPlan === 'pro' || userPlan === 'corp'
  const isPlus = userPlan === 'plus'
  const isFree = userPlan === 'free'

  const currentGlobalModel = settings.integrations?.aiModel || (isPlus ? 'qwen/qwen3.6-27b' : isProOrCorp ? 'openai/gpt-oss-120b' : 'meta-llama/Llama-3.1-8B-Instruct')
  const taskModels = settings.integrations?.aiTaskModels || {}

  const [savedToast, setSavedToast] = useState(false)

  const showSaved = () => {
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2000)
  }

  const handleGlobalModelChange = (modelId: string) => {
    update({
      integrations: {
        ...settings.integrations,
        aiModel: modelId,
      }
    })
    showSaved()
  }

  const handleTaskModelChange = (taskKey: 'chat' | 'parser' | 'goals' | 'reschedule' | 'analytics', modelId: string) => {
    if (!isProOrCorp) return
    update({
      integrations: {
        ...settings.integrations,
        aiTaskModels: {
          ...taskModels,
          [taskKey]: modelId,
        }
      }
    })
    showSaved()
  }

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
              {isProOrCorp ? '👑 Режим Pro & Corp: Полная кастомизация ИИ' : isPlus ? '⚡ Режим Plus: 3 модели ИИ' : '🆓 Базовый режим: 2 легковесные модели'}
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
              ? 'Вам доступен выбор любой нейросети под каждый тип задач отдельно, а также максимальный приоритет и кастомные системные промпты.'
              : isPlus
              ? 'Вам доступна мощная модель Qwen 3.6 27B + 2 легкие модели. Оформите Pro, чтобы настраивать отдельную нейросеть для каждой задачи!'
              : 'На бесплатном тарифе можно выбрать 1 модель для всех задач из 2 легковесных (Llama 3.1 8B или Qwen 2.5 7B).'}
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

      {/* Voice Transcription Info (Always cheapest Whisper) */}
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
      {(!isProOrCorp) && (
        <div className="space-y-3">
          <h4 className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground px-1">
            Выбор основной ИИ-модели для задач и чата
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Llama 3.1 8B */}
            <button
              type="button"
              onClick={() => handleGlobalModelChange('meta-llama/Llama-3.1-8B-Instruct')}
              className={cn(
                "p-3.5 rounded-2xl border text-left flex flex-col justify-between space-y-2 transition-all cursor-pointer",
                currentGlobalModel === 'meta-llama/Llama-3.1-8B-Instruct'
                  ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40"
                  : "border-border bg-card hover:border-border/80 hover:bg-accent/40"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Llama 3.1 8B</span>
                {currentGlobalModel === 'meta-llama/Llama-3.1-8B-Instruct' && (
                  <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Сверхлегкая и экономичная модель для базового ввода и быстрых команд</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground w-fit">8 млрд параметров</span>
            </button>

            {/* Qwen 2.5 7B */}
            <button
              type="button"
              onClick={() => handleGlobalModelChange('Qwen/Qwen2.5-7B-Instruct')}
              className={cn(
                "p-3.5 rounded-2xl border text-left flex flex-col justify-between space-y-2 transition-all cursor-pointer",
                currentGlobalModel === 'Qwen/Qwen2.5-7B-Instruct'
                  ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40"
                  : "border-border bg-card hover:border-border/80 hover:bg-accent/40"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Qwen 2.5 7B</span>
                {currentGlobalModel === 'Qwen/Qwen2.5-7B-Instruct' && (
                  <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Компактная быстрая модель с хорошим русским языком</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground w-fit">7 млрд параметров</span>
            </button>

            {/* Qwen 3.6 27B (Available on Plus, Locked on Free) */}
            <button
              type="button"
              onClick={() => {
                if (isPlus) {
                  handleGlobalModelChange('qwen/qwen3.6-27b')
                } else if (onUpgradeClick) {
                  onUpgradeClick()
                }
              }}
              className={cn(
                "p-3.5 rounded-2xl border text-left flex flex-col justify-between space-y-2 transition-all sm:col-span-2",
                isPlus && currentGlobalModel === 'qwen/qwen3.6-27b'
                  ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40"
                  : isPlus
                  ? "border-border bg-card hover:border-border/80 hover:bg-accent/40 cursor-pointer"
                  : "border-border/60 bg-muted/40 opacity-70 cursor-pointer"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground">Qwen 3.6 27B</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Рекомендуется
                  </span>
                </div>
                {isPlus && currentGlobalModel === 'qwen/qwen3.6-27b' ? (
                  <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                ) : !isPlus ? (
                  <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Тариф Plus (99 ₽)
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">Продвинутая модель с мощной логикой, глубоким пониманием дел и точным структурированием расписания</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground w-fit">27 млрд параметров</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode 2: Pro & Corp Per-Task Customization */}
      {isProOrCorp ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
              Индивидуальная настройка нейросетей по типам задач
            </h4>
            <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Без ограничений
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
                {ALL_MODELS.map(m => (
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
                {ALL_MODELS.map(m => (
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
                {ALL_MODELS.map(m => (
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
                {ALL_MODELS.map(m => (
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
                {ALL_MODELS.map(m => (
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
            В тарифе Pro и Corp вы сможете закрепить отдельную флагманскую модель (GPT-OSS 120B, Qwen 72B, GPT-OSS 20B) за каждым типом задач: чат, парсинг, цели, перепланирование и аналитика.
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
    </div>
  )
}
