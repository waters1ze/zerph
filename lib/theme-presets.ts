/**
 * Zerf — Visual Presets + Controlled Toggles
 *
 * Кураторская кастомизация: пользователь выбирает одну из пяти продуманных
 * тем (каждая — полный набор из 40+ токенов в globals.css), а поверх может
 * безопасно настроить акцент (только из проверенной палитры), размер текста,
 * плотность, радиусы и форму элементов. Свободный color picker запрещён —
 * гармонию сломать нельзя.
 */

export type ThemePresetId = 'strict' | 'warm' | 'blue' | 'vivid' | 'paper'
export type DensityMode = 'compact' | 'default' | 'comfortable'
export type RadiusMode = 'sharp' | 'default' | 'rounded'
export type TextScaleStep = -1 | 0 | 1 | 2 | 3

export interface AccentOption {
  id: string
  label: string
  /** Основной цвет акцента (oklch) */
  color: string
  /** Цвет текста/иконок поверх акцента (oklch) */
  fg: string
}

export interface ThemePresetMeta {
  id: ThemePresetId
  label: string
  tagline: string
  isDark: boolean
  /** Мини-превью для карточки в настройках */
  preview: { bg: string; surface: string; accent: string }
  /** id акцента по умолчанию (первый в палитре) */
  defaultAccent: string
}

export const THEME_PRESETS: ThemePresetMeta[] = [
  {
    id: 'paper',
    label: 'Paper',
    tagline: 'Кремовая светлая, чернильный акцент',
    isDark: false,
    preview: { bg: 'oklch(0.972 0.007 85)', surface: 'oklch(0.995 0.004 85)', accent: 'oklch(0.17 0.006 80)' },
    defaultAccent: 'ink',
  },
  {
    id: 'blue',
    label: 'Blue',
    tagline: 'Светлый корпоративный, холодный и спокойный',
    isDark: false,
    preview: { bg: 'oklch(0.977 0.004 250)', surface: 'oklch(0.995 0.002 250)', accent: 'oklch(0.48 0.16 258)' },
    defaultAccent: 'blue',
  },
  {
    id: 'strict',
    label: 'Strict',
    tagline: 'Инженерный монохром. Серьёзный инструмент',
    isDark: true,
    preview: { bg: 'oklch(0.10 0.002 260)', surface: 'oklch(0.16 0.002 260)', accent: 'oklch(0.985 0 0)' },
    defaultAccent: 'white',
  },
  {
    id: 'warm',
    label: 'Warm',
    tagline: 'Тёплый чёрный с шампанским золотом',
    isDark: true,
    preview: { bg: 'oklch(0.085 0.006 70)', surface: 'oklch(0.145 0.008 70)', accent: 'oklch(0.78 0.15 78)' },
    defaultAccent: 'gold',
  },
  {
    id: 'vivid',
    label: 'Vivid',
    tagline: 'Тёмный с одним выразительным цветом',
    isDark: true,
    preview: { bg: 'oklch(0.115 0.012 300)', surface: 'oklch(0.175 0.014 300)', accent: 'oklch(0.72 0.19 300)' },
    defaultAccent: 'violet',
  },
]

/** Палитра акцентов для тёмных тем — светлые оттенки, читаемые на чёрном (WCAG AA) */
const DARK_ACCENTS: AccentOption[] = [
  { id: 'white',   label: 'Белый',      color: 'oklch(0.985 0 0)',        fg: 'oklch(0.13 0.002 260)' },
  { id: 'steel',   label: 'Стальной',   color: 'oklch(0.75 0.005 260)',   fg: 'oklch(0.13 0.002 260)' },
  { id: 'gold',    label: 'Золотой',    color: 'oklch(0.78 0.15 78)',     fg: 'oklch(0.14 0.03 70)' },
  { id: 'amber',   label: 'Янтарный',   color: 'oklch(0.80 0.14 65)',     fg: 'oklch(0.14 0.03 60)' },
  { id: 'coral',   label: 'Коралловый', color: 'oklch(0.75 0.14 40)',     fg: 'oklch(0.13 0.03 40)' },
  { id: 'ruby',    label: 'Рубиновый',  color: 'oklch(0.74 0.15 15)',     fg: 'oklch(0.13 0.03 15)' },
  { id: 'mint',    label: 'Мятный',     color: 'oklch(0.78 0.13 165)',    fg: 'oklch(0.12 0.03 165)' },
  { id: 'emerald', label: 'Изумрудный', color: 'oklch(0.74 0.14 152)',    fg: 'oklch(0.12 0.03 152)' },
  { id: 'teal',    label: 'Морской',    color: 'oklch(0.75 0.11 195)',    fg: 'oklch(0.12 0.03 195)' },
  { id: 'sky',     label: 'Небесный',   color: 'oklch(0.75 0.11 230)',    fg: 'oklch(0.12 0.03 230)' },
  { id: 'indigo',  label: 'Индиго',     color: 'oklch(0.72 0.13 275)',    fg: 'oklch(0.12 0.03 275)' },
  { id: 'violet',  label: 'Фиолетовый', color: 'oklch(0.74 0.16 300)',    fg: 'oklch(0.13 0.04 300)' },
]

/** Палитра для светлых тем — средние/тёмные оттенки с белым текстом */
const LIGHT_ACCENTS: AccentOption[] = [
  { id: 'blue',    label: 'Синий',        color: 'oklch(0.48 0.16 258)',  fg: 'oklch(0.99 0 0)' },
  { id: 'navy',    label: 'Тёмно-синий',  color: 'oklch(0.38 0.11 260)',  fg: 'oklch(0.99 0 0)' },
  { id: 'indigo',  label: 'Индиго',       color: 'oklch(0.46 0.16 275)',  fg: 'oklch(0.99 0 0)' },
  { id: 'violet',  label: 'Фиолетовый',   color: 'oklch(0.48 0.17 300)',  fg: 'oklch(0.99 0 0)' },
  { id: 'teal',    label: 'Морской',      color: 'oklch(0.47 0.10 200)',  fg: 'oklch(0.99 0 0)' },
  { id: 'emerald', label: 'Изумрудный',   color: 'oklch(0.45 0.12 155)',  fg: 'oklch(0.99 0 0)' },
  { id: 'forest',  label: 'Лесной',       color: 'oklch(0.38 0.10 150)',  fg: 'oklch(0.99 0 0)' },
  { id: 'amber',   label: 'Янтарный',     color: 'oklch(0.58 0.13 65)',   fg: 'oklch(0.17 0.02 65)' },
  { id: 'rust',    label: 'Медный',       color: 'oklch(0.50 0.14 45)',   fg: 'oklch(0.99 0 0)' },
  { id: 'ruby',    label: 'Рубиновый',    color: 'oklch(0.48 0.18 15)',   fg: 'oklch(0.99 0 0)' },
  { id: 'slate',   label: 'Графитовый',   color: 'oklch(0.42 0.02 250)',  fg: 'oklch(0.99 0 0)' },
  { id: 'ink',     label: 'Чернильный',   color: 'oklch(0.20 0.005 80)',  fg: 'oklch(0.975 0.007 85)' },
]

/** Vivid допускает чуть более насыщенные варианты тех же оттенков */
const VIVID_ACCENTS: AccentOption[] = DARK_ACCENTS.map(a =>
  a.id === 'violet'
    ? { ...a, color: 'oklch(0.72 0.19 300)' }
    : a
)

export function accentPaletteFor(theme: ThemePresetId): AccentOption[] {
  if (theme === 'blue' || theme === 'paper') return LIGHT_ACCENTS
  if (theme === 'vivid') return VIVID_ACCENTS
  return DARK_ACCENTS
}

export const TEXT_SCALE_PX: Record<TextScaleStep, number> = {
  '-1': 14,
  0: 16,
  1: 17,
  2: 18,
  3: 19,
}

export const DENSITY_MODES: { id: DensityMode; label: string; hint: string }[] = [
  { id: 'compact', label: 'Компактно', hint: 'Как сейчас' },
  { id: 'default', label: 'Обычно', hint: '+15% воздуха' },
  { id: 'comfortable', label: 'Просторно', hint: '+30% воздуха' },
]

export const RADIUS_MODES: { id: RadiusMode; label: string; hint: string }[] = [
  { id: 'sharp', label: 'Строгие', hint: '4px' },
  { id: 'default', label: 'Обычные', hint: '10px' },
  { id: 'rounded', label: 'Круглые', hint: '16px' },
]

const ALL_THEME_CLASSES = ['theme-strict', 'theme-warm', 'theme-blue', 'theme-vivid', 'theme-paper']
const ALL_MOD_CLASSES = ['density-compact', 'density-default', 'density-comfortable', 'radius-sharp', 'radius-default', 'radius-rounded', 'shapes-square']

/** Миграция старых значений (light/dark/system) на новые пресеты */
export function normalizeTheme(value: string | undefined): ThemePresetId {
  switch (value) {
    case 'strict': case 'warm': case 'blue': case 'vivid': case 'paper':
      return value
    // Прежняя тёмная тема была золотой, но строгий корпоративный дефолт
    // важнее сохранения старого вида: все получают Strict и выбирают сами
    case 'light':
      return 'paper'
    default:
      return 'strict'
  }
}

export interface ApplyVisualsOptions {
  theme: ThemePresetId
  /** id акцента из палитры темы или 'default' */
  accentId: string
  textScale: TextScaleStep
  density: DensityMode
  radius: RadiusMode
  /** true = круглые элементы (по умолчанию), false = сглаженно-квадратные */
  roundShapes: boolean
  /** Кастомный CSS из расширения темы / GitHub */
  customCss?: string
}

/**
 * Применяет весь визуальный слой: классы на <html>/<body> + инлайн-переопределение
 * акцента + инъекция кастомных CSS стилей/анимаций из тем.
 */
export function applyVisualsToDocument(opts: ApplyVisualsOptions) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const body = document.body
  const meta = THEME_PRESETS.find(t => t.id === opts.theme)
    ?? THEME_PRESETS.find(t => t.id === 'strict')!

  root.classList.remove(...ALL_THEME_CLASSES, 'dark', 'light')
  body.classList.remove(...ALL_THEME_CLASSES, 'dark', 'light')
  // Тема дублируется на <body>: иначе старый `.dark`-блок на body остаётся
  // ближе к контенту и перекрывает --primary жёлтым из прежней палитры
  root.classList.add(`theme-${meta.id}`)
  body.classList.add(`theme-${meta.id}`)
  if (meta.isDark) {
    root.classList.add('dark')
    body.classList.add('dark')
  }

  root.classList.remove(...ALL_MOD_CLASSES)
  root.classList.add(`density-${opts.density}`)
  root.classList.add(`radius-${opts.radius}`)
  if (!opts.roundShapes) root.classList.add('shapes-square')

  const px = TEXT_SCALE_PX[opts.textScale] ?? 16
  root.style.fontSize = `${px}px`

  const palette = accentPaletteFor(meta.id)
  const accent =
    opts.accentId && opts.accentId !== 'default'
      ? palette.find(a => a.id === opts.accentId)
      : undefined

  const targets = [root, body]

  if (accent) {
    for (const el of targets) {
      el.style.setProperty('--primary', accent.color, 'important')
      el.style.setProperty('--primary-foreground', accent.fg, 'important')
      el.style.setProperty('--brand', accent.color, 'important')
      el.style.setProperty('--brand-foreground', accent.fg, 'important')
      el.style.setProperty('--sidebar-primary', accent.color, 'important')
      el.style.setProperty('--sidebar-primary-foreground', accent.fg, 'important')
      el.style.setProperty('--ring', `color-mix(in oklab, ${accent.color} 40%, transparent)`, 'important')
      el.style.setProperty('--chart-1', accent.color, 'important')
    }
  } else {
    for (const el of targets) {
      el.style.removeProperty('--primary')
      el.style.removeProperty('--primary-foreground')
      el.style.removeProperty('--brand')
      el.style.removeProperty('--brand-foreground')
      el.style.removeProperty('--sidebar-primary')
      el.style.removeProperty('--sidebar-primary-foreground')
      el.style.removeProperty('--ring')
      el.style.removeProperty('--chart-1')
    }
  }

  // Custom CSS & Animations Injection (from GitHub themes or custom styles)
  let styleEl = document.getElementById('zerf-custom-theme-style') as HTMLStyleElement | null
  if (opts.customCss && opts.customCss.trim()) {
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'zerf-custom-theme-style'
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = opts.customCss
  } else if (styleEl) {
    styleEl.remove()
  }
}
