import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Shield, Lock, Sparkles, CheckCircle2, Globe } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Политика конфиденциальности | Zerf Note & AI',
  description: 'Официальная политика конфиденциальности и обработки персональных данных Zerf Note. Соответствие Google API Services User Data Policy и защита данных.',
}

export default function PrivacyPolicyPage() {
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
          <div className="flex items-center gap-2 text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full">
            <Shield className="w-3.5 h-3.5" />
            <span>Google API Verified Policy</span>
          </div>
        </div>

        {/* Title Block */}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Политика конфиденциальности Zerf Note
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Дата последнего обновления: 18 августа 2026 г. | Редакция 2.4 (Google API Compliance)
          </p>
        </div>

        {/* Main Content Cards */}
        <div className="space-y-6 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          
          {/* Section 1: Overview */}
          <section className="p-6 rounded-3xl bg-card border border-border space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <span className="text-primary font-mono text-sm">01.</span>
              <span>Общие положения и оператор данных</span>
            </h2>
            <p>
              Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональной информации пользователей сервиса <b>Zerf Note</b> (доступного по адресу <a href="https://zeprh.vercel.app" className="text-primary hover:underline font-mono">https://zeprh.vercel.app</a>, в боте Telegram <span className="font-mono text-foreground">@Zerph_bot</span>, мобильных и десктопных приложениях).
            </p>
            <p>
              Мы со всей серьезностью относимся к вашей приватности. Сервис Zerf Note разработан по принципу <b>Privacy-First</b>: мы собираем только тот минимум данных, который строго необходим для функционирования планировщика, синхронизации задач и работы персонального ИИ-ассистента.
            </p>
          </section>

          {/* Section 2: Google API Limited Use Policy */}
          <section className="p-6 rounded-3xl bg-rose-500/5 border border-rose-500/30 space-y-4">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm sm:text-base">
              <Lock className="w-4 h-4" />
              <span>Положение об использовании данных Google API (Google User Data Policy)</span>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-rose-500/20 text-foreground font-medium text-xs space-y-2">
              <p>
                <b>Google API Services User Data Policy Compliance:</b> Zerf Note’s use and transfer of information received from Google APIs to any other app will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-primary underline">Google API Services User Data Policy</a>, including the Limited Use requirements.
              </p>
            </div>
            <p>
              При подключении функции <b>«Google Календарь (2-Way Sync)»</b> приложение запрашивает доступ к области видимости Google Calendar (<code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">https://www.googleapis.com/auth/calendar.events</code>) и адресу электронной почты (<code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">userinfo.email</code>).
            </p>
            <ul className="space-y-2 list-disc list-inside pl-2">
              <li><b>Цель запроса:</b> Отображение событий Google Календаря в вашем расписании Zerf и экспорт созданных вами задач в Google Календарь в реальном времени по вашему запросу.</li>
              <li><b>Запрет продажи:</b> Мы <b>никогда не продаем</b> пользовательские данные Google третьим лицам или рекламодателям.</li>
              <li><b>Запрет рекламы:</b> Данные Google API <b>никогда не используются</b> для показа рекламы или таргетинга.</li>
              <li><b>Запрет обучения общих ИИ-моделей:</b> Данные вашего календаря <b>не используются</b> для обучения или дообучения публичных обобщенных моделей искусственного интеллекта.</li>
              <li><b>Отзыв доступа:</b> Вы можете отключить синхронизацию с Google Календарем в любой момент в 1 клик в Настройках («Профиль & Вход» → «Отключить Google Календарь») или на странице безопасности своего Google Аккаунта.</li>
            </ul>
          </section>

          {/* Section 3: AI Disclaimer & Disclaimers */}
          <section className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/30 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <span className="text-amber-400 font-mono text-sm">02.</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Отказ от ответственности за ответы ИИ (AI Disclaimer)</span>
            </h2>
            <p>
              Сервис Zerf Note интегрирует современные языковые модели искусственного интеллекта (включая Llama, Qwen, OpenAI GPT-OSS) для помощи в формулировании задач, составлении расписания, генерации идей и аналитике продуктивности.
            </p>
            <div className="p-4 rounded-2xl bg-card border border-amber-500/20 text-foreground text-xs space-y-2">
              <p className="font-bold text-amber-300">Внимание:</p>
              <p>
                1. Ответы, подсказки и расписания, формируемые нейросетью, генерируются автоматически вероятностными алгоритмами и могут содержать неточности, фактические ошибки или искажения информации (галлюцинации ИИ).
              </p>
              <p>
                2. Разработчики, администрация и операторы сервиса Zerf Note <b>не несут ответственности</b> за любые ошибки в сгенерированных ответах, пропущенные дедлайны, финансовые, юридические, медицинские или деловые решения, принятые пользователем на основании подсказок нейросети.
              </p>
              <p>
                3. Пользователь обязуется самостоятельно проверять критически важные даты, напоминания и рекомендации перед совершением юридически значимых или ответственных действий.
              </p>
            </div>
          </section>

          {/* Section 4: What Data is Collected */}
          <section className="p-6 rounded-3xl bg-card border border-border space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <span className="text-primary font-mono text-sm">03.</span>
              <span>Категории собираемых данных</span>
            </h2>
            <ul className="space-y-2 list-disc list-inside pl-2">
              <li><b>Учетные данные:</b> Идентификатор Telegram Chat ID, имя пользователя, Email (при регистрации через Email/Google), хеш пароля (с солью Argon2/SHA-256).</li>
              <li><b>Пользовательский контент:</b> Созданные задачи, заметки, списки покупок, дедлайны, проекты и цели, которые вы сохраняете в системе.</li>
              <li><b>Голосовые и аудиоданные:</b> Голосовые сообщения обрабатываются исключительно для моментальной транскрипции в текст (Speech-to-Text via Groq Whisper API) и не хранятся на постоянных серверах после распознавания.</li>
              <li><b>Технические данные:</b> IP-адрес для защиты от брутфорса, токены сессий браузера, диагностические логи сбоев.</li>
            </ul>
          </section>

          {/* Section 5: Data Security & Retention */}
          <section className="p-6 rounded-3xl bg-card border border-border space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <span className="text-primary font-mono text-sm">04.</span>
              <span>Безопасность и хранение данных</span>
            </h2>
            <p>
              Все данные между вашим устройством и серверами Zerf передаются с использованием защищенного сквозного шифрования TLS 1.3 (HTTPS). Базы данных защищены сетевыми экранами и резервируются в зашифрованном виде.
            </p>
            <p>
              Вы можете в любой момент выполнить полный экспорт всех своих данных в формате JSON или запросить безвозвратное удаление аккаунта со всеми связанными записями в разделе «Настройки» → «Резервные копии & Данные».
            </p>
          </section>

          {/* Section 6: Contact */}
          <section className="p-6 rounded-3xl bg-card border border-border space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <span className="text-primary font-mono text-sm">05.</span>
              <span>Контакты и обратная связь</span>
            </h2>
            <p>
              По любым вопросам обработки персональных данных, политики конфиденциальности или работы интеграций вы можете связаться со службой поддержки:
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 font-mono text-xs">
              <span className="px-3 py-1.5 rounded-xl bg-muted border border-border text-foreground">
                Email: support@zerf.app
              </span>
              <a
                href="https://t.me/waters1ze"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
              >
                Telegram: @waters1ze
              </a>
              <a
                href="https://t.me/Zerph_bot"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                Бот: @Zerph_bot
              </a>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© 2026 Zerf Note Team. Все права защищены.</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-foreground transition-colors underline">
              Пользовательское соглашение (Terms)
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
