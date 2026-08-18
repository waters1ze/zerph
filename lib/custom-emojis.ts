/**
 * Custom Zerf Ecosystem Emojis & Mascots Catalog
 * Signature hand-crafted digital avatars & badges designed exclusively for Zerf Note.
 */

export interface CustomZerfEmoji {
  id: string
  name: string
  category: string
  badgeLabel: string
  description: string
  color: string
}

export const ZERF_CUSTOM_EMOJIS: CustomZerfEmoji[] = [
  {
    id: 'zerfik_spirit',
    name: 'Зерфик Дух',
    category: 'Зерфик Маскот',
    badgeLabel: 'Маскот',
    description: 'Оригинальный цифровой дух-хранитель Zerf Note',
    color: '#38bdf8',
  },
  {
    id: 'zerfik_focus',
    name: 'Зерфик Фокус',
    category: 'Зерфик Маскот',
    badgeLabel: 'Фокус',
    description: 'Зерфик в режиме глубокой концентрации и ясности',
    color: '#818cf8',
  },
  {
    id: 'zerfik_wink',
    name: 'Зерфик Подмигивание',
    category: 'Зерфик Маскот',
    badgeLabel: 'Вдохновение',
    description: 'Дружелюбный и мотивирующий Зерфик',
    color: '#a78bfa',
  },
  {
    id: 'zerfik_zen',
    name: 'Зерфик Дзен',
    category: 'Зерфик Маскот',
    badgeLabel: 'Баланс',
    description: 'Спокойный медитативный ритм работы и планирования',
    color: '#34d399',
  },
  {
    id: 'zerfik_cyber',
    name: 'Зерфик Кибер',
    category: 'Зерфик Маскот',
    badgeLabel: 'Cyberpunk',
    description: 'Кибернетический неоновый аватар Зерфика',
    color: '#f43f5e',
  },
  {
    id: 'zerf_ai',
    name: 'Zerf AI Core',
    category: 'Экосистема Zerf',
    badgeLabel: 'AI Ядро',
    description: 'Нейросетевое ядро автономного анализа',
    color: '#6366f1',
  },
  {
    id: 'zerf_brain',
    name: 'Второй Мозг',
    category: 'Экосистема Zerf',
    badgeLabel: 'Brain',
    description: 'Архитектура Second Brain и база знаний',
    color: '#c084fc',
  },
  {
    id: 'zerf_crystal',
    name: 'Кристалл Entropy',
    category: 'Экосистема Zerf',
    badgeLabel: 'Кристалл',
    description: 'Фрактальный кристалл глубокого поиска Entropy',
    color: '#22d3ee',
  },
  {
    id: 'zerf_cli',
    name: 'Zerf CLI Terminal',
    category: 'Экосистема Zerf',
    badgeLabel: 'CLI',
    description: 'Символ консольного интерфейса и разработчиков',
    color: '#4ade80',
  },
  {
    id: 'zerf_matrix',
    name: 'Граф Связей',
    category: 'Экосистема Zerf',
    badgeLabel: 'Граф',
    description: 'Интеллектуальная сеть связанных заметок и задач',
    color: '#60a5fa',
  },
  {
    id: 'zerf_lightning',
    name: 'Быстрый Поток',
    category: 'Экосистема Zerf',
    badgeLabel: 'Flow',
    description: 'Молниеносная скорость работы и фокуса',
    color: '#facc15',
  },
  {
    id: 'zerf_crown',
    name: 'Zerf Creator VIP',
    category: 'Экосистема Zerf',
    badgeLabel: 'VIP',
    description: 'Эксклюзивная корона создателя и Pro-статуса',
    color: '#fbbf24',
  },
  {
    id: 'zerf_shield',
    name: 'Zerf Vault',
    category: 'Экосистема Zerf',
    badgeLabel: 'Защита',
    description: 'Шифрование и приватность ваших персональных данных',
    color: '#38bdf8',
  },
  {
    id: 'zerf_streak',
    name: 'Огненный Стрик',
    category: 'Экосистема Zerf',
    badgeLabel: 'Стрик',
    description: 'Непрерывная цепочка выполненных целей',
    color: '#fb923c',
  },
]

export function isCustomZerfEmoji(idOrChar?: string | null): boolean {
  if (!idOrChar) return false
  return ZERF_CUSTOM_EMOJIS.some(e => e.id === idOrChar)
}

export function getCustomZerfEmoji(idOrChar?: string | null): CustomZerfEmoji | undefined {
  if (!idOrChar) return undefined
  return ZERF_CUSTOM_EMOJIS.find(e => e.id === idOrChar)
}
