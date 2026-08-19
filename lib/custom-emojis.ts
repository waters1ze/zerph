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
  // ── Зерфик и Милые Аватары Лиц (Эстетичные векторные иконки в кружочке) ──
  {
    id: 'zerfik_spirit',
    name: 'Зерфик Дух',
    category: 'Маскот & Лица',
    badgeLabel: 'Маскот',
    description: 'Оригинальный сияющий пиксельный дух-хранитель Zerf Note',
    color: '#38bdf8',
  },
  {
    id: 'face_star_eyes',
    name: 'Звёздные глазки',
    category: 'Маскот & Лица',
    badgeLabel: '★ Глазки',
    description: 'Милое личико в кружочке с сияющими звёздочками в глазах',
    color: '#fbbf24',
  },
  {
    id: 'face_sparkle_wink',
    name: 'Искорка',
    category: 'Маскот & Лица',
    badgeLabel: 'Подмигивание',
    description: 'Подмигивающее игривое личико со звёздным блеском',
    color: '#f43f5e',
  },
  {
    id: 'face_cute_blush',
    name: 'Кавайный румянец',
    category: 'Маскот & Лица',
    badgeLabel: 'Румянец',
    description: 'Милейшее довольное личико с нежным румянцем',
    color: '#ec4899',
  },
  {
    id: 'face_heart_eyes',
    name: 'Сердечки в глазах',
    category: 'Маскот & Лица',
    badgeLabel: '♥ Любовь',
    description: 'Влюблённое эстетичное личико с сердечками в глазах',
    color: '#e11d48',
  },
  {
    id: 'face_kitty_cute',
    name: 'Котик',
    category: 'Маскот & Лица',
    badgeLabel: 'Ушки :3',
    description: 'Милая кошачья мордочка с ушками и усиками',
    color: '#a855f7',
  },
  {
    id: 'face_happy_smile',
    name: 'Счастливая улыбка',
    category: 'Маскот & Лица',
    badgeLabel: 'Радость',
    description: 'Сияющая позитивная улыбка',
    color: '#10b981',
  },
  {
    id: 'face_sleepy_dream',
    name: 'Сонный мечтатель',
    category: 'Маскот & Лица',
    badgeLabel: 'Дзен',
    description: 'Умиротворённое спящее личико с закрытыми глазками',
    color: '#818cf8',
  },
  {
    id: 'face_cyber_pixel',
    name: 'Тамагочи',
    category: 'Маскот & Лица',
    badgeLabel: 'Pixel',
    description: 'Пиксельное личико в стиле ретро-тамагочи',
    color: '#06b6d4',
  },
  {
    id: 'face_spark_hero',
    name: 'Звёздный герой',
    category: 'Маскот & Лица',
    badgeLabel: 'Энергия',
    description: 'Уверенное вдохновляющее личико с молнией',
    color: '#eab308',
  },

  // ── Реальные нейросети (Ч/Б монохромные) ──
  {
    id: 'ai_deepseek',
    name: 'DeepSeek',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'R1 / V3',
    description: 'Флагманская модель логических рассуждений DeepSeek R1',
    color: '#ffffff',
  },
  {
    id: 'ai_openai',
    name: 'OpenAI / ChatGPT',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'GPT-4o',
    description: 'Официальный символ OpenAI и ChatGPT',
    color: '#ffffff',
  },
  {
    id: 'ai_claude',
    name: 'Claude / Anthropic',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'Sonnet 3.7',
    description: 'Интеллектуальный ассистент Claude от Anthropic',
    color: '#ffffff',
  },
  {
    id: 'ai_perplexity',
    name: 'Perplexity AI',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'Search',
    description: 'Поисково-аналитический AI-движок фактов и первоисточников',
    color: '#ffffff',
  },
  {
    id: 'ai_gemini',
    name: 'Google Gemini',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'Flash / Pro',
    description: 'Мультимодальная нейросеть Gemini от Google',
    color: '#ffffff',
  },
  {
    id: 'ai_midjourney',
    name: 'Midjourney',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'v6.1',
    description: 'Генератор концепт-арта и цифровых изображений',
    color: '#ffffff',
  },
  {
    id: 'ai_groq',
    name: 'Groq LPU',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'LPUs Ultra',
    description: 'Сверхскоростной тензорный инференс со скоростью 500+ tok/s',
    color: '#ffffff',
  },
  {
    id: 'ai_mistral',
    name: 'Mistral AI',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'Le Chat / Large',
    description: 'Европейская открытая архитектура Mistral & Mixtral',
    color: '#ffffff',
  },
  {
    id: 'ai_llama',
    name: 'Meta Llama',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'Llama 3.3',
    description: 'Открытая флагманская нейросеть Llama от Meta',
    color: '#ffffff',
  },
  {
    id: 'ai_cursor',
    name: 'Cursor AI',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'IDE',
    description: 'Нейросетевая среда разработки и кодинга Cursor',
    color: '#ffffff',
  },
  {
    id: 'ai_v0',
    name: 'v0 by Vercel',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'UI / Generative',
    description: 'Генеративный ИИ для интерфейсов и React-компонентов',
    color: '#ffffff',
  },
  {
    id: 'ai_huggingface',
    name: 'Hugging Face',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'Open Source',
    description: 'Главный мировой хаб открытых нейросетей и весов',
    color: '#ffffff',
  },
  {
    id: 'ai_qwen',
    name: 'Qwen AI',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'Alibaba 2.5',
    description: 'Мощная мультиязычная модель Qwen от Alibaba Cloud',
    color: '#ffffff',
  },
  {
    id: 'ai_elevenlabs',
    name: 'ElevenLabs',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'Voice AI',
    description: 'Синтез естественного голоса и клонирование речи',
    color: '#ffffff',
  },
  {
    id: 'ai_apple_intelligence',
    name: 'Apple Intelligence',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'Apple',
    description: 'Персональный ИИ и нейрочипы Apple Silicon',
    color: '#ffffff',
  },
  {
    id: 'ai_copilot',
    name: 'GitHub Copilot',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'Copilot',
    description: 'ИИ парный программист от GitHub',
    color: '#ffffff',
  },
  {
    id: 'ai_suno',
    name: 'Suno AI',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'Music AI',
    description: 'Генерация музыки, треков и вокала через нейросети',
    color: '#ffffff',
  },
  {
    id: 'ai_runway',
    name: 'Runway Gen-3',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'Video AI',
    description: 'Генерация кинематографичного видео по тексту',
    color: '#ffffff',
  },
  {
    id: 'ai_flux',
    name: 'FLUX.1',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'Black Forest',
    description: 'Современный генератор фотореалистичных изображений',
    color: '#ffffff',
  },
  {
    id: 'ai_kling',
    name: 'Kling AI',
    category: 'Нейросети (ИИ)',
    badgeLabel: 'Motion AI',
    description: 'Нейросетевая физика движения и генерация видео',
    color: '#ffffff',
  },

  // ── Экосистема Zerf ──
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
