import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Sparkles, Shield, AlertTriangle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Условия использования (Terms of Service) | Zerf Note',
  description: 'Пользовательское соглашение и условия использования сервиса Zerf Note. Отказ от ответственности за генерации искусственного интеллекта.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-primary/20 selection:text-primary">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex items-center justify-between pb-6 border-b border-border">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Вернуться в Zerf Note</span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Terms of Service v2.4</span>
          </div>
        </div>

        {/* Title Block */}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Пользовательское соглашение Zerf Note
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Вступает в силу с 18 августа 2026 г. | Редакция 2.4
          </p>
        </div>

        {/* Content */}
        <div className="space-y-6 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          
          {/* Section 1 */}
          <section className="p-6 rounded-3xl bg-card border border-border space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <span className="text-primary font-mono text-sm">01.</span>
              <span>Принятие условий</span>
            </h2>
            <p>
              Используя веб-сайт <a href="https://zeprh.vercel.app" className="text-primary hover:underline font-mono">https://zeprh.vercel.app</a>, бота Telegram <span className="font-mono text-foreground">@Zerph_bot</span> или иные клиенты сервиса <b>Zerf Note</b>, вы подтверждаете свое полное и безоговорочное согласие с настоящими Условиями и Политикой конфиденциальности.
            </p>
          </section>

          {/* Section 2: AI Disclaimer */}
          <section className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/30 space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm sm:text-base">
              <AlertTriangle className="w-4 h-4" />
              <span>Отказ от ответственности за ответы и работу ИИ (AI Disclaimer)</span>
            </div>
            <p>
              Сервис Zerf Note использует современные алгоритмы генеративного искусственного интеллекта (Large Language Models) для парсинга задач, структурирования расписания, генерации подсказок и текстовых ответов ассистента.
            </p>
            <div className="p-4 rounded-2xl bg-card border border-amber-500/20 text-foreground text-xs space-y-2">
              <p>
                <b>1. Вероятностный характер:</b> Пользователь признает, что ответы искусственного интеллекта генерируются статистическими методами и могут содержать неточности, фактические ошибки, неверно интерпретированные даты или устаревшие данные.
              </p>
              <p>
                <b>2. Отсутствие гарантий:</b> Мы не даем гарантий безошибочности, пригодности для конкретных коммерческих, юридических, медицинских или инвестиционных целей ответов ИИ.
              </p>
              <p>
                <b>3. Ограничение ответственности:</b> Администрация сервиса Zerf Note, разработчики и операторы <b>не несут ответственности</b> за любые прямые или косвенные убытки, упущенную выгоду, пропущенные встречи, ошибки в расписании или решения, принятые на основе ответов ИИ-ассистента.
              </p>
            </div>
          </section>

          {/* Section 3: Third Party Integrations */}
          <section className="p-6 rounded-3xl bg-card border border-border space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <span className="text-primary font-mono text-sm">03.</span>
              <span>Сторонние интеграции (Google, Telegram, VK)</span>
            </h2>
            <p>
              Интеграция с сервисом Google Календарь осуществляется в строгом соответствии с <Link href="/privacy" className="text-primary underline">Политикой конфиденциальности Google API</Link>. Пользователь вправе в любой момент отозвать предоставленные разрешения на синхронизацию.
            </p>
          </section>

          {/* Section 4: Subscriptions and Refunds */}
          <section className="p-6 rounded-3xl bg-card border border-border space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <span className="text-primary font-mono text-sm">04.</span>
              <span>Подписки и платные тарифы (Plus, Pro, Corp)</span>
            </h2>
            <p>
              Платные подписки предоставляют расширенные квоты на распознавание голоса, запросы Siri, количество заметок и напоминаний. Оплата производится через официальные платежные шлюзы (YooMoney / Банковские карты). Продление подписки происходит по завершении оплаченного периода.
            </p>
          </section>

          {/* Section 5: Termination */}
          <section className="p-6 rounded-3xl bg-card border border-border space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <span className="text-primary font-mono text-sm">05.</span>
              <span>Прекращение использования и удаление данных</span>
            </h2>
            <p>
              Пользователь может в любой момент прекратить использование сервиса и экспортировать или безвозвратно удалить все свои данные через интерфейс настроек («Резервные копии & Данные» → «Удалить аккаунт»).
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© 2026 Zerf Note Team. Все права защищены.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors underline">
              Политика конфиденциальности (Privacy)
            </Link>
            <Link href="/" className="hover:text-foreground transition-colors">
              Главная
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
