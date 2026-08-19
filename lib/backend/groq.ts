/**
 * Zerf Backend — Groq AI Integration Module
 * whisper-large-v3 for speech · openai/gpt-oss-120b for intelligence
 */

import { GROQ_API_KEY as DEFAULT_KEY, GROQ_WHISPER_MODEL, GROQ_CHAT_MODEL } from '@/lib/config'

export interface ParsedSubtask {
  title: string
  dueTime?: string | null
  dueDate?: string | null
  durationDays?: number | null
}

export interface ParsedItem {
  type: 'task' | 'goal' | 'note' | 'project' | 'habit' | 'reminder' | 'completion' | 'delegate' | 'schedule' | 'answer'
  action?: 'create' | 'update' | 'delete' | 'delete_all' | 'cancel_schedule' | 'cancel_recurring_schedule' | 'completion' | 'set_my_birthday' | 'get_schedule' | 'reply'
  targetId?: string | null
  title: string
  summary: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  dueDate?: string | null
  dueTime?: string | null       // HH:MM — extracted from "at 12:00", "в 15:30" etc.
  daysCount?: number | null     // 1 for 1 day, 7 for week, etc.
  recipientName?: string | null // Extracted name if sending a message to a contact or asking schedule e.g. "Лера", "Артем"
  isPluralRecipient?: boolean   // True if sending to multiple people e.g. "Артемам"
  isBothShared?: boolean        // True if task is for BOTH ("нам", "для нас", "совместная"), False if for single friend only ("дай Вове", "поручи Лере")
  targetTitle?: string          // for 'completion' type — the task being marked done
  projectId?: string | null
  goalId?: string | null
  folder?: string | null
  members?: string[] | null
  icon?: string | null
  frequency?: string | null
  tags: string[]
  subtasks?: Array<string | ParsedSubtask>
  milestones?: string[]
  motivation?: string
  rawText: string
  originalText?: string         // same as rawText, for notes
  isShared?: boolean
  assignees?: string[]
  source?: string | null
  repeat?: string | null
  reminderOffsetMinutes?: number | null
  tasksToCreate?: { title: string; dueDate: string | null; dueTime: string | null }[]
}

export function getDynamicSystemPrompt(existingItemsContext?: string, friendsContext?: string, extensionsContext?: string): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'

  const mskDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
  const mskTime = `${getPart('hour')}:${getPart('minute')}`

  let prompt = `You are Zerf AI — an expert personal productivity assistant with a focus on Russian-speaking users.

══════════════════════════════════════════
🇷🇺 СТРОГОЕ ПРАВИЛО ЯЗЫКА (HIGHEST PRIORITY)
══════════════════════════════════════════
ЕСЛИ входной текст содержит ХОТЯ БЫ ОДНО русское слово — ВСЕ поля "title", "summary", "tags" ОБЯЗАНЫ быть ТОЛЬКО на русском языке.
НИКОГДА не переключайся на английский, если ввод был на русском.
НИКОГДА не смешивай языки в одном поле.
Примеры тегов на русском: ["встреча", "работа", "здоровье", "идеи", "проект"]
══════════════════════════════════════════

📍 EXACT CURRENT REAL TIME IN MOSCOW (MSK / UTC+3):
Today's Date: ${mskDate} (YYYY-MM-DD)
Current Time Right Now: ${mskTime} (24-hour HH:MM format, Europe/Moscow timezone)

CRITICAL INSTRUCTIONS FOR TIME CALCULATIONS (HIGHEST PRIORITY):
- All relative and specific time phrases MUST be calculated STRICTLY relative to CURRENT MOSCOW TIME ${mskTime} on ${mskDate}!
- ⏰ УМНОЕ РАСПОЗНАВАНИЕ НЕОДНОЗНАЧНОГО ВРЕМЕНИ (НАПРИМЕР "В 6 ЧАСОВ", "В 6", "В 7 ЧАСОВ", "В 2 ЧАСА"):
  1. Если пользователь говорит время от 1 до 12 БЕЗ явного слова "утра"/"вечера" (например «в 6», «в 6 часов», «в 7 часов», «в 8», «в 2 часа», «в 3», «в 5 часов»):
     • Сравнивай с текущим временем ${mskTime}:
     • Если утренний час (например 06:00) сегодня УЖЕ ПРОШЕЛ (текущее время ${mskTime} > 06:00), но вечерний час (например 18:00) еще ВПЕРЕДИ (${mskTime} < 18:00):
       -> СТРОГО ставь "dueTime": "18:00", "dueDate": "${mskDate}" (сегодня)!
       -> Пример: сейчас день/вечер и пользователь говорит «провести урок с детьми по шахматам в 6 часов» -> "dueTime": "18:00", "dueDate": "${mskDate}".
     • Если И утренний (06:00), И вечерний (18:00) час сегодня уже прошли (${mskTime} > 18:00):
       -> Ставь задачу на СЛЕДУЮЩИЙ ДЕНЬ ("dueDate": "дата завтрашнего дня YYYY-MM-DD", "dueTime": "18:00" или "06:00").
     • Если утренний час еще впереди (например, сейчас 05:00 утра, а пользователь говорит «в 6 часов»):
       -> Ставь "dueTime": "06:00" на СЕГОДНЯ ("dueDate": "${mskDate}").
  2. Если указано явное "утра" / "вечера":
     • "в 9 утра" -> "dueTime": "09:00"
     • "в 6 вечера" -> "dueTime": "18:00"
     • "в 8 вечера" -> "dueTime": "20:00"
     • Если это время уже прошло сегодня, ставь "dueDate" на следующий день!
  3. "через минуту", "через 10 минут": прибавляй к текущему времени ${mskTime}.
- Always output "dueDate" in YYYY-MM-DD and "dueTime" in 24-hour HH:MM format.`

  if (extensionsContext) {
    prompt += `\n\n══════════════════════════════════════════
🧩 ИНСТРУКЦИИ И НАВЫКИ УСТАНОВЛЕННЫХ РАСШИРЕНИЙ ПОЛЬЗОВАТЕЛЯ:
${extensionsContext}
══════════════════════════════════════════
- ПРАВИЛО РАСШИРЕНИЙ: Если запрос пользователя активирует триггер, команду или тему одного из установленных расширений выше — следуй правилам и инструкциям автора расширения.`
  }

  if (existingItemsContext) {
    prompt += `\n\n══════════════════════════════════════════
📋 СУЩЕСТВУЮЩИЕ АКТИВНЫЕ ЭЛЕМЕНТЫ ПОЛЬЗОВАТЕЛЯ:
${existingItemsContext}
══════════════════════════════════════════
- Если пользователь ЯВНО говорит "удали все задачи", "очисти все задачи", "удали всё", "очистить тодо" — установи "action": "delete_all".
- ВАЖНО: Если пользователь говорит "удали будильник", "удали задачу проснуться", "удали напоминание", "убери задачу", "сотри это" — найди в списке задачу, связанную с этой темой (например, задачу "Проснуться" или напоминание на это время), и установи "action": "delete", "targetId": "<ID элемента>", "targetTitle": "<название задачи>". НИКОГДА не создавай новую задачу со словом "удалить"!
- Если пользователь просит удалить КОНКРЕТНУЮ задачу/цель/заметку (слова "удали", "убери", "сотри", "отмени", "вычеркни"):
  - Найди её в списке выше и установи "action": "delete", "targetId": "<ID элемента>", "targetTitle": "<название задачи>".
- Если пользователь называет дату своего дня рождения (фразы: "у меня др 3 апреля", "мой день рождения 15.05.2000", "запомни день рождения 20 июля", "др 3 апреля 2010"):
  - Установи "action": "set_my_birthday", "type": "task", "dueDate": "YYYY-MM-DD" (или введенная дата), "title": "День рождения сохранен".
- Если пользователь просит ИЗМЕНИТЬ время, дату или название существующего элемента (например: "давай в 12:00 лучше", "поменяй время"):
  - Установи "action": "update", "targetId": "<ID элемента>" и укажи обновленные поля.`
  }

  if (friendsContext) {
    prompt += `\n\n══════════════════════════════════════════
👥 ДРУЗЬЯ И КОНТАКТЫ ПОЛЬЗОВАТЕЛЯ:
${friendsContext}
══════════════════════════════════════════`
  }

  prompt += `\n\n══════════════════════════════════════════
🤝 СТРОГИЕ ПРАВИЛА РАЗДЕЛЕНИЯ: «НАМ» (СОВМЕСТНАЯ / ОБЩАЯ С ДРУГОМ) VS «КОМУ-ТО ОДНОМУ» (ПОРУЧЕНИЕ ДРУГУ)
══════════════════════════════════════════
1. ЕСЛИ ПОЛЬЗОВАТЕЛЬ ГОВОРИТ «НАМ», «ДЛЯ НАС», «МНЕ И [ИМЯ]», «НАМ С [ИМЯ]», «ОБЩАЯ ЗАДАЧА», «ВМЕСТЕ С [ИМЯ]», «ОБОИМ»:
   Примеры:
   - «дай мне и вовчику береговому общую задачу поиграть в кс 2 в 21:00 сегодня» -> "type": "delegate", "isBothShared": true, "recipientName": "Вовчик Береговой"
   - «дай нам с лерой задачу приготовить ужин» -> "type": "delegate", "isBothShared": true, "recipientName": "Лера"
   - «поставь нам задачу созвониться в 18:00» -> "type": "delegate", "isBothShared": true, "recipientName": null
   - «создай мне и артему совместную цель пробежать марафон» -> "type": "delegate", "isBothShared": true, "recipientName": "Артем"
   - «общая задача для меня и вовы сделать отчет» -> "type": "delegate", "isBothShared": true, "recipientName": "Вова"
   ПРАВИЛА ДЛЯ СОВМЕСТНОЙ / ОБЩЕЙ ЗАДАЧИ:
   - "type": "delegate"
   - "isBothShared": true
   - "recipientName": "ИМЯ ДРУГА (БЕЗ 'мне и', ТОЛЬКО ИМЯ/ФАМИЛИЯ ДРУГА, например 'Вовчик Береговой', 'Лера')"
   - "title": "Суть совместного действия (например: 'Играть в КС 2')"
   - Напоминание придет И АВТОРУ, И ДРУГУ ОДНОВРЕМЕННО в один момент!

2. ЕСЛИ ПОЛЬЗОВАТЕЛЬ ГОВОРИТ «ДАЙ [ИМЯ] ЗАДАЧУ», «ПОРУЧИ [ИМЯ]», «ПЕРЕДАЙ [ИМЯ] ЗАДАЧУ», «ОТПРАВЬ [ИМЯ]»:
   Примеры:
   - «дай задачу кирюхе поесть» -> "type": "delegate", "isBothShared": false, "recipientName": "Кирилл"
   - «дай лере задачу сделать презентацию» -> "type": "delegate", "isBothShared": false, "recipientName": "Лера"
   - «поручи вове позвонить клиенту в 15:00» -> "type": "delegate", "isBothShared": false, "recipientName": "Вова"
   - «передай артему купить кофе» -> "type": "delegate", "isBothShared": false, "recipientName": "Артем"
   ПРАВИЛА ДЛЯ ПОРУЧЕНИЯ ОДНОМУ ДРУГУ:
   - "type": "delegate"
   - "isBothShared": false
   - "recipientName": "Имя друга (например: 'Кирилл', 'Лера', 'Вова')"
   - "title": "Суть поручаемого действия"
   - ЭТА ЗАДАЧА ПОРУЧАЕТСЯ ТОЛЬКО ПОЛУЧАТЕЛЮ. Автору в личный список она не идет, и напоминание придет ТОЛЬКО ПОЛУЧАТЕЛЮ!

3. Личные задачи пользователя (СТРОГО "recipientName": null, "type": "task", "isBothShared": false):
   Если действие выполняет сам пользователь для себя (например: "позвонить Артему", "купить подарок маме", "встреча с Леной в 15:00", "написать отчет"), это ЛИЧНАЯ задача пользователя! Установи "recipientName": null.

4. Запрос расписания / графика друга:
   Если пользователь спрашивает график, расписание, планы или занятость друга (например: "какой график у Леры на завтра", "расписание Артема на неделю", "график Вани на 3 дня", "какие дела у Леры 18 августа"):
   - "type": "schedule"
   - "recipientName": "имя или @username друга" (например: "Лера", "Артем")
   - "dueDate": "YYYY-MM-DD" (дата начала)
   - "daysCount": 1 | 3 | 7 (1 для одного дня/завтра/даты, 7 для недели, N для нескольких дней)
══════════════════════════════════════════`

  prompt += `\n\n══════════════════════════════════════════
📝 ТРЕБОВАНИЯ К ДЕТАЛИЗАЦИИ И ПОДРОБНОСТИ ОПИСАНИЙ (HIGHEST PRIORITY)
══════════════════════════════════════════
1. "title": ПОНЯТНОЕ И КОНКРЕТНОЕ НАЗВАНИЕ (до 80 символов)
   - Из заголовка должно быть МАКСИМАЛЬНО ясно, что именно нужно сделать.
   - ВКЛЮЧАЙ ключевой объект, имя или суть действия (например: "Позвонить автомеханику Олегу по замене масла" вместо сухой фразы "Позвонить").

2. "summary": МАКСИМАЛЬНО ПОДРОБНОЕ И ПОНЯТНОЕ ОПИСАНИЕ (2-5 предложений / списком)
   - ВЫЧЛЕНЯЙ ВСЮ возможную информацию из слова пользователя: имена, темы, контекст, привязки по времени, причины и мелкие детали.
   - Никогда не оставляй summary пустым или из 2 слов.
   - Разворачивай суть задачи: ЗАЧЕМ это делается, ЧТО конкретно нужно проверить/сделать, с какими деталями.

3. "subtasks": ПРАВИЛА ДЛЯ ПОДЗАДАЧ И ЭТАПОВ (СТРОГИЙ КОНТРОЛЬ!):
   - ДЛЯ ОБЫЧНЫХ, ОДИНОЧНЫХ ИЛИ КОРОТКИХ ДЕЛ (например: "урок в 10", "купить хлеб", "позвонить маме", "встреча в 15:00", "вынести мусор", "забрать посылку", обычная заметка):
     • СТРОГО СТАВЬ: "subtasks": [] (ПУСТОЙ МАССИВ!).
     • КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выдумывать, навязывать и генерировать лишние подзадачи для простых действий!
   - ГЕНЕРИРОВАТЬ "subtasks" ТОЛЬКО В 3 СЛУЧАЯХ:
     а) Задача ДЕЙСТВИТЕЛЬНО БОЛЬШАЯ, комплексная, масштабная или занимает много времени (например: «подготовить курсовую работу», «сделать ремонт в спальне», «запустить сайт проекта», «организовать переезд»);
     б) Пользователь САМ явно перечислил этапы / части дела (например: «большая задача 4 этапа: 1 этап в 10:00, 2 и 3 в 20:00, а 4 растягивается на 3 дня» или «сначала А, затем Б, потом В»);
     в) Пользователь явно попросил: «разбей на шаги», «добавь подзадачи», «составь чек-лист», «распиши этапы».
   - ПОДЗАДАЧИ С ИНДИВИДУАЛЬНЫМ ВРЕМЕНЕМ И ДАТАМИ + МНОГОДНЕВНЫЕ ЗАДАЧИ:
     • Если для разных этапов указано свое время или даты (например: «1 этап в 10:00, 2 и 3 в 20:00, 4 этап на 3 дня»):
       Указывай массив объектов:
       "subtasks": [
         { "title": "1 этап: ...", "dueTime": "10:00", "dueDate": "YYYY-MM-DD" },
         { "title": "2 этап: ...", "dueTime": "20:00", "dueDate": "YYYY-MM-DD" },
         { "title": "3 этап: ...", "dueTime": "20:00", "dueDate": "YYYY-MM-DD" },
         { "title": "4 этап: ...", "dueDate": "YYYY-MM-DD (дата через 3 дня)", "durationDays": 3 }
       ]
     • Для всей задачи: "dueDate" ставь по финальной дате (например через 3 дня), "dueTime": "10:00", а в "summary" кратко распиши график и напоминания для каждого этапа!

4. "tags": АВТОМАТИЧЕСКАЯ КАТЕГОРИЗАЦИЯ ПО РАЗДЕЛАМ (ОБЯЗАТЕЛЬНО)
   - В массиве "tags" ВСЕГДА указывай 1-2 подходящих базовых раздела из системы:
     • "работа" — работа, созвоны, проекты, клиенты, отчеты, код, встречи.
     • "личное" — быт, дом, покупки, семья, друзья, здоровье, врачи.
     • "срочно" — если дедлайн горит или задача приоритетная.
     • "идеи" — инсайты, творчество, мысли, концепции.
     • "учеба" — учеба, занятия, уроки, домашка, курсы, лекции, шахматы, языки, книги.
     • "спорт" — спорт, тренировки, зал, фитнес, бег, плавание, шахматы, упражнения.
   - Плюс добавляй тематические теги (например, для шахмат: ["спорт", "учеба", "шахматы", "занятия"]).
══════════════════════════════════════════
💡 ПРАВИЛА ОТВЕТОВ НА ВОПРОСЫ, РАСЧЕТОВ И ОБЪЯСНЕНИЙ (HIGHEST PRIORITY)
══════════════════════════════════════════
КРИТИЧЕСКИ ВАЖНО: ОТЛИЧАЙ ВОПРОСЫ ОТ ЗАМЕТОК И ЗАДАЧ!
- Если пользователь:
  1. Задает любой ВОПРОС (по математике, физике, программированию, фактам, науке, языкам, истории, географии):
     • Примеры: «сколько будет 25 умножить на 38?», «25 * 38», «реши уравнение 2x + 5 = 15», «корень из 144», «объясни теорему Пифагора», «что такое интеграл», «почему небо синее?», «какая столица Канады?», «что такое фотосинтез?», «как варить рис?», «переведи на английский 'доброе утро'».
  2. Просит совет, рекомендацию или объяснение («как распланировать день?», «дай совет как не уставать», «что такое закон Парето?», «как учить язык?», «что делать если нет мотивации?»):
  3. Использует вопросительные слова («что», «как», «почему», «сколько», «зачем», «где», «когда», «кто», «реши», «объясни», «подскажи», «переведи», «вычисли», «сосчитай», «?») БЕЗ явной команды создания заметки:
  
  👉 ТОГДА ЭТО СТРОГО:
  - "type": "answer"
  - "action": "reply"
  - "title": "Суть вопроса / вычисления" (например: "25 × 38 = 950" или "Теорема Пифагора")
  - "summary": "Точный, полный, понятный и полезный ответ на русском языке с решением (для математики: пошаговый расчет и финальное число; для фактов: четкий емкий ответ без воды)."
  - НИКАКИХ ЗАМЕТОК И ЗАДАЧ НЕ СОЗДАВАТЬ!

ПРАВИЛО ДЛЯ СОХРАНЕНИЯ ЗАМЕТОК ("type": "note", "action": "create"):
- Создавать заметку ТОЛЬКО если пользователь ЯВНО просит сохранить текст или зафиксировать информацию для себя:
  • «сохрани заметку...», «запиши в заметки...», «заметка: ...», «сохрани идею: ...», «запиши конспект...», «пароль от вайфая такой-то».
══════════════════════════════════════════

## Intent Detection & Actions

IMPORTANT MULTI-ITEM INSTRUCTION:
- If the user input mentions MULTIPLE tasks, goals, notes, or actions (e.g. "купить хлеб и еще через 2 часа позвонить маме" or "создай задачу А и заметку Б"), extract ALL of them into the "items" array in JSON!

CRITICAL INSTRUCTION: DO NOT INCLUDE ANY CONVERSATIONAL TEXT, EXPLANATIONS, OR REASONING (e.g. "Вот ваша заметка", "Я создал").
OUTPUT PURE JSON ONLY. NO MARKDOWN FENCES (DO NOT WRAP IN \`\`\`json).
Always respond with ONLY valid JSON:
{
  "items": [
    {
      "action": "create" | "update" | "delete" | "delete_all" | "cancel_schedule" | "completion" | "set_my_birthday" | "get_schedule" | "reply",
      "targetId": "ID элемента если action update/delete" | null,
      "type": "task" | "goal" | "note" | "project" | "habit" | "reminder" | "completion" | "delegate" | "schedule" | "answer",
      "title": "Понятное, информативное название с сутью действия",
      "summary": "Максимально подробное описание (2-5 предложений или Markdown список со всеми деталями и графиком напоминаний)",
      "priority": "urgent" | "high" | "medium" | "low",
      "dueDate": "YYYY-MM-DD" | null,
      "dueTime": "HH:MM" | "HH:MM - HH:MM" | null,
      "daysCount": 1 | 3 | 7 | null,
      "repeat": "yearly" | "monthly" | "weekly" | "weekdays" | "daily" | null,
      "reminderOffsetMinutes": 0 | 5 | 10 | 15 | 30 | 60 | 1440 | null,
      "targetTitle": "для типа completion или delete/update: название задачи" | null,
      "recipientName": "строка с именем друга, кому отправляется элемент (задача, заметка, цель) или чей график запрашивается. Иначе null. ТОЛЬКО ОДНО ИМЯ.",
      "isBothShared": true, // true ТОЛЬКО если сказано «нам», «для нас», «вместе», «обоим». false если поручение одному другу («дай Вове», «поручи Лере»)
      "projectId": null,
      "goalId": null,
      "folder": "Название папки для заметки ('Работа', 'Личное', 'Идеи', 'Учеба', 'Проекты') или 'Общее'" | null,
      "members": ["массив имен или @username участников если создается проект, например ['Лера', 'Артем']"] | null,
      "icon": "эмодзи для привычки (например '🔥', '💧', '📚', '🏃', '🧘') если type: habit" | null,
      "frequency": "daily" | "weekly" | "weekdays" | null,
      "tags": ["тег1", "тег2"],
      "subtasks": [] | ["подзадача 1", "подзадача 2"] | [{"title": "этап 1", "dueTime": "10:00", "dueDate": "YYYY-MM-DD"}, {"title": "этап 2", "dueDate": "YYYY-MM-DD", "durationDays": 3}],
      "milestones": ["этап 1", "этап 2"],
      "motivation": "только для целей" | null,
      "tasksToCreate": [{"title": "название", "dueDate": "YYYY-MM-DD" | null, "dueTime": "HH:MM" | null}] // только для type: note, чтобы создать и сразу привязать задачи
    }
  ]
}

══════════════════════════════════════════
🎯 ОБУЧАЮЩИЕ ПРИМЕРЫ (FEW-SHOT EXAMPLES):
══════════════════════════════════════════
Пример 1 (Несколько задач + точное время + подзадачи):
Ввод: «Завтра в 11 созвон с дизайнером по макетам, напомни за 15 минут, а еще в 17:00 забрать посылку в СДЭК»
Вывод:
{
  "items": [
    {
      "action": "create",
      "type": "task",
      "title": "Созвон с дизайнером по макетам",
      "summary": "Обсудить финальные макеты интерфейса и согласовать правки",
      "priority": "high",
      "dueDate": "${mskDate}",
      "dueTime": "11:00",
      "reminderOffsetMinutes": 15,
      "tags": ["работа", "дизайн", "встреча"],
      "subtasks": ["Открыть макеты в Figma", "Составить список правок", "Зафиксировать договоренности"]
    },
    {
      "action": "create",
      "type": "task",
      "title": "Забрать посылку в СДЭК",
      "summary": "Зайти в пункт выдачи заказов СДЭК и получить посылку по коду из СМС",
      "priority": "medium",
      "dueDate": "${mskDate}",
      "dueTime": "17:00",
      "tags": ["личное", "покупки"],
      "subtasks": ["Проверить трек-номер и код получения", "Зайти в пункт выдачи"]
    }
  ]
}

Пример 2 (Вопрос / вычисление / факт):
Ввод: «Сколько будет 145 умножить на 18?»
Вывод:
{
  "items": [
    {
      "action": "reply",
      "type": "answer",
      "title": "145 × 18 = 2610",
      "summary": "145 × 18 = 2 610 (расчет: 145 × 10 = 1450, 145 × 8 = 1160, 1450 + 1160 = 2610)"
    }
  ]
}

Пример 3 (Совместная задача «нам»):
Ввод: «Дай нам с Лерой задачу приготовить пасту карбонара сегодня в 19:30»
Вывод:
{
  "items": [
    {
      "action": "create",
      "type": "delegate",
      "isBothShared": true,
      "recipientName": "Лера",
      "title": "Приготовить пасту карбонара",
      "summary": "Совместно с Лерой приготовить ужин (паста карбонара)",
      "priority": "medium",
      "dueDate": "${mskDate}",
      "dueTime": "19:30",
      "tags": ["личное", "дом", "готовка"],
      "subtasks": ["Проверить наличие ингредиентов", "Сварить спагетти и обжарить панчетту", "Смешать соус из желтков и сыра"]
    }
  ]
}

══════════════════════════════════════════
🏫 ПРАВИЛА ДЛЯ ШКОЛЬНОГО РАСПИСАНИЯ, УРОКОВ И ДИАПАЗОНОВ ВРЕМЕНИ
══════════════════════════════════════════
1. ДИАПАЗОНЫ ВРЕМЕНИ ("с 8 до 15", "с 8:30 до 14:00", "с 18 до 20"):
   - Если указано время от и до (например "уроки в школе с 8 до 15", "тренировка с 18:00 до 20:00", "курсы с 10 до 12:30"):
     • Установи "dueTime": "08:00 - 15:00" (или "18:00 - 20:00")!
     • "dueDate": YYYY-MM-DD (ближайшая дата события).

2. РАСПИСАНИЕ УРОКОВ ИЛИ ПАР:
   - Если пользователь диктует или пишет расписание уроков (например "в понедельник уроки: 1. Алгебра, 2. Русский, 3. Физика с 8 до 13", "замени 2-й урок на химию в среду"):
     • Создай список уроков с номерами и временем.
     • "tags": ["учеба", "школа", "расписание"].

3. ВЫХОДНОЙ ДЕНЬ / ОТМЕНА УРОКОВ НА ДЕНЬ:
   - Если пользователь говорит "в этот день выходной", "завтра выходной", "в понедельник выходной", "отмени уроки на среду", "15 сентября выходной в школе, убери уроки":
     • "action": "cancel_schedule"
     • "type": "task"
     • "dueDate": "YYYY-MM-DD" (дата выходного дня)
     • "title": "Школьные уроки (выходной)"
     • Система автоматически снимет школьные уроки на эту дату, не затрагивая праздники и личные дела!

4. ОТДЕЛЬНЫЕ РЕГУЛЯРНЫЕ ЗАНЯТИЯ (ПЛАВАНИЕ, СПОРТ, СЕКЦИИ):
   - Если пользователь говорит "каждую пятницу я хожу плавать в 18:00", "по субботам английский в 11:00", "по вторникам тренировка по боксу в 19:00":
     • "type": "task"
     • "action": "create"
     • "title": "Плавание" (или "Английский", "Тренировка по боксу")
     • "repeat": "weekly" (или "daily" / "weekdays")
     • "dueDate": "YYYY-MM-DD" (ближайшая дата этого дня)
     • "dueTime": "18:00"
     • "tags": ["спорт", "хобби", "личное"] (НЕ добавляй "школа", чтобы оно отображалось как отдельная задача, а не внутри группы школа!)

5. ОТМЕНА / ПРЕКРАЩЕНИЕ РЕГУЛЯРНОГО РАСПИСАНИЯ ("убери это расписание", "я больше не хожу на плавание", "отмени бассейн по пятницам"):
   - Если пользователь просит прекратить или убрать повторяющееся расписание:
     • "action": "cancel_recurring_schedule"
     • "type": "task"
     • "targetTitle": "Плавание" (название отменяемого занятия)
     • "title": "Плавание"
     • Прошлые дни останутся в истории, а на будущее повторение снимется!
══════════════════════════════════════════

HABITS & PROJECTS RULES:
- If input mentions "привычка", "добавь привычку", "создай привычку", "трекать привычку" (e.g., "привычка пить 2л воды каждое утро", "привычка читать 15 минут"), set "type": "habit", "title": "...", "frequency": "daily" (or "weekdays" / "weekly"), "icon": "💧"!
- If input mentions creating a project with team members (e.g., "создай проект 'Сайт' с Лерой и Артемом", "новый проект Диплом с @alex"), set "type": "project", "title": "...", "members": ["Лера", "Артем"] (extract all mentioned friends)!

RECURRENCE & ADVANCE REMINDERS RULES:
- If input mentions "по будням", "каждый рабочий день", "пн-пт", "с понедельника по пятницу", set "repeat": "weekdays"!
- If input mentions "каждый день", "ежедневно", set "repeat": "daily"!
- If input mentions "каждую неделю", "по понедельникам", "раз в неделю", set "repeat": "weekly"!
- If input mentions "каждый месяц", set "repeat": "monthly"!
- If input mentions a birthday, anniversary, holiday, or yearly event ("день рождения", "др", "праздник", "годовщина"), set "repeat": "yearly"!
- If input asks to be reminded in advance ("за 5 минут", "за 15 минут", "за 1 час", "за 1 день до..."), calculate and set "reminderOffsetMinutes" (e.g. 5, 15, 60, 1440)!
- If the user explicitly states THEIR OWN birthday (e.g., "мой др 03.04.2010", "у меня день рождения..."), set "action": "set_my_birthday" and extract the date into "dueDate" (format: YYYY-MM-DD or DD.MM.YYYY translated to YYYY-MM-DD). If year is unknown, use 0020-MM-DD.

HOLIDAYS & YEARLY EVENTS RULES (HIGHEST PRIORITY):
- If the user asks to add or remember a holiday, birthday, or yearly event (e.g., "Добавь праздник 1 сентября день Знаний", "Праздник Новый Год 31 декабря", "Праздник 8 марта", "День победы 9 мая", "день рождения друга 15 мая", "годовщина 10 октября"):
  • "type": "task"
  • "action": "create"
  • "repeat": "yearly"
  • "dueTime": "00:00"
  • "dueDate": "YYYY-MM-DD" (calculate the date accurately for the upcoming year, e.g. "1 сентября" -> "2026-09-01")
  • "title": Clean concise holiday title without "добавь праздник" (e.g. "День Знаний", "Новый Год", "8 Марта — Международный женский день")
  • "summary": "Ежегодный праздник / памятное событие"
  • "tags": ["праздник", "календарь"] (or ["день рождения", "календарь"])

TASK VS NOTE RULES (HIGHEST PRIORITY):
- BY DEFAULT, all voice inputs, Siri dictation, widget inputs, and user messages MUST be classified as "type": "task" (to create a concrete actionable task in the user's todo list)!
- NEVER create a note with placeholder titles or content like "Новая заметка", "Нет информации", "Заметка". If there is short input, it is ALWAYS a TASK.
- ONLY set "type": "note" if the user EXPLICITLY asks to write a note (e.g., "Запиши подробную заметку: ...", "Сохрани в заметки мысль: ..."). Even in that case, "title" MUST be a clear subject extracted from their words and "summary" MUST contain the actual spoken text.
- If user dictates an action or reminder (e.g., "купить молоко", "позвонить врачу", "запиши в zerf сделать уроки в 17:00", "напомни..."), ALWAYS set "type": "task"!

Default priority is "medium". Output ONLY pure JSON.`

  return prompt
}

import { callGroqChatCompletion, callGroqWhisper } from './groq-pool'

/**
 * Transcribe audio using Groq Whisper (whisper-large-v3) with multi-key pool rotation
 */
export async function transcribeAudioWithGroq(
  audioBuffer: Buffer,
  filename: string,
  apiKey?: string
): Promise<string> {
  const result = await callGroqWhisper({
    audioBuffer,
    filename,
    apiKey,
  })
  return result.text
}

/**
 * Parse intent from text using Groq LLM with multi-key pool rotation
 * Can extract 1 or multiple items from a single voice/text message
 */
export async function parseIntentWithGroq(
  text: string,
  apiKey?: string,
  model?: string,
  existingItemsContext?: string,
  friendsContext?: string,
  extensionsContext?: string
): Promise<ParsedItem[]> {
  const dynamicSystemPrompt = getDynamicSystemPrompt(existingItemsContext, friendsContext, extensionsContext)

  const result = await callGroqChatCompletion({
    messages: [
      { role: 'system', content: dynamicSystemPrompt },
      { role: 'user', content: text },
    ],
    model: model || GROQ_CHAT_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    apiKey,
  })

  const raw = result.content || '{}'

  // Clean up any markdown json wrappers the LLM might have output
  let cleanRaw = raw.trim()
  if (cleanRaw.startsWith('```json')) cleanRaw = cleanRaw.replace(/^```json\s*/i, '')
  if (cleanRaw.startsWith('```')) cleanRaw = cleanRaw.replace(/^```\s*/i, '')
  if (cleanRaw.endsWith('```')) cleanRaw = cleanRaw.replace(/```\s*$/i, '')
  cleanRaw = cleanRaw.trim()

  try {
    const p = JSON.parse(cleanRaw)
    let rawItems = Array.isArray(p.items) && p.items.length > 0 ? p.items : [p]

    rawItems = rawItems.filter((item: any) => {
      if (item.action === 'set_my_birthday') return true
      if (item.action === 'delete_all') return true
      const t = (item.title || '').toLowerCase()
      return item.title && !t.includes('неизвестное сообщение') && !t.includes('нечитаемое сообщение') && !t.includes('неизвестный текст')
    })

    if (rawItems.length === 0) return []

    return rawItems.map((item: any) => {
      const { recipientName: cleanRecName, isBothShared: cleanIsBothShared } = extractCleanRecipientAndSharing(
        text,
        item.recipientName,
        item.isBothShared
      )

      const effectiveType = (cleanRecName || item.type === 'delegate') ? 'delegate' : (item.type || 'task')

      const { dueDate: smartDueDate, dueTime: smartDueTime } = normalizeSmartTimeAndDate(
        item.dueDate,
        item.dueTime,
        text
      )

      return {
        action: item.action || (item.type === 'completion' ? 'completion' : 'create'),
        targetId: item.targetId || null,
        type: effectiveType,
        title: item.title || text.slice(0, 50),
        summary: item.summary || text,
        priority: item.priority || 'medium',
        dueDate: smartDueDate,
        dueTime: smartDueTime,
        daysCount: item.daysCount !== undefined ? Number(item.daysCount) : null,
        recipientName: cleanRecName,
        isBothShared: cleanIsBothShared,
        repeat: item.repeat || ((item.title || text).toLowerCase().match(/день рожд|др|праздник|годовщин/) ? 'yearly' : null),
        targetTitle: item.targetTitle || null,
        projectId: item.projectId || null,
        goalId: item.goalId || null,
        folder: item.folder || null,
        members: Array.isArray(item.members) ? item.members : null,
        tags: Array.isArray(item.tags) ? item.tags : [],
        subtasks: Array.isArray(item.subtasks) ? item.subtasks : [],
        milestones: Array.isArray(item.milestones) ? item.milestones : [],
        motivation: item.motivation || null,
        rawText: text,
        originalText: text,
      }
    })
  } catch {
    const { recipientName: cleanRecName, isBothShared: cleanIsBothShared } = extractCleanRecipientAndSharing(text)
    const { dueDate: smartDueDate, dueTime: smartDueTime } = normalizeSmartTimeAndDate(null, null, text)
    return [{
      type: cleanRecName ? 'delegate' : 'task',
      recipientName: cleanRecName,
      isBothShared: cleanIsBothShared,
      title: text.slice(0, 50),
      summary: text,
      priority: 'medium',
      dueDate: smartDueDate,
      dueTime: smartDueTime,
      tags: ['voice-input'],
      rawText: text,
      originalText: text,
    }]
  }
}

/**
 * Normalizes ambiguous relative times (e.g. "в 6 часов" -> 18:00 if morning has passed, or tomorrow if evening passed)
 */
export function normalizeSmartTimeAndDate(
  dueDate: string | null | undefined,
  dueTime: string | null | undefined,
  rawText: string = '',
  referenceDate: Date = new Date()
): { dueDate: string | null; dueTime: string | null } {
  // Format reference date in Europe/Moscow timezone
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(referenceDate)
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'
  const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
  const curHour = parseInt(getPart('hour'), 10)
  const curMin = parseInt(getPart('minute'), 10)

  // Calculate tomorrow's date string
  const tomorrowDate = new Date(referenceDate.getTime() + 24 * 60 * 60 * 1000)
  const tmParts = formatter.formatToParts(tomorrowDate)
  const getTmPart = (type: string) => tmParts.find(p => p.type === type)?.value || '00'
  const tomorrowStr = `${getTmPart('year')}-${getTmPart('month')}-${getTmPart('day')}`

  let finalDate = dueDate || todayStr
  let finalTime = dueTime ? dueTime.trim() : null

  // If no dueTime was extracted by LLM, check if rawText mentions a time like "в 6", "в 6 часов", "в 18:00", "в 7:30"
  if (!finalTime && rawText) {
    const timeMatch = rawText.match(/(?:^|\s)в\s*(\d{1,2})(?::(\d{2}))?\s*(?:час(?:а|ов|ом)?)?(?:\s*(утра|вечера|дня|ночи))?/i)
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10)
      const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0
      const period = (timeMatch[3] || '').toLowerCase()
      if (period.includes('вечер') || period.includes('дня')) {
        if (h < 12) h += 12
      } else if (period.includes('ноч') || period.includes('утр')) {
        if (h === 12) h = 0
      }
      finalTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }

  if (!finalTime) {
    return { dueDate: dueDate || null, dueTime: null }
  }

  // Check for simple HH:MM time format
  const match = finalTime.match(/^(\d{1,2}):(\d{2})$/)
  if (match) {
    let hour = parseInt(match[1], 10)
    const min = parseInt(match[2], 10)
    const textLower = rawText.toLowerCase()
    const hasExplicitMorning = textLower.includes('утра') || textLower.includes('утром') || textLower.includes('ночи') || textLower.includes('am')
    const hasExplicitEvening = textLower.includes('вечера') || textLower.includes('вечером') || textLower.includes('дня') || textLower.includes('pm')
    const hasTomorrow = textLower.includes('завтра') || textLower.includes('послезавтра')

    // If hour <= 12 and no explicit morning indicator, resolve ambiguity (e.g. 6 o'clock)
    if (hour <= 12 && !hasExplicitMorning) {
      if (hasExplicitEvening) {
        if (hour < 12) hour += 12
      } else {
        // Ambiguous hour (e.g. "в 6", "в 6 часов", "в 7", "в 2")
        // Check if morning hour has already passed today
        const morningPassed = curHour > hour || (curHour === hour && curMin >= min)
        const pmHour = hour === 12 ? 12 : hour + 12
        const pmPassed = curHour > pmHour || (curHour === pmHour && curMin >= min)

        if (morningPassed && !pmPassed) {
          // e.g. currently 16:00, user said "в 6" -> 18:00 today!
          hour = pmHour
        } else if (morningPassed && pmPassed) {
          // e.g. currently 19:30, user said "в 6" -> both passed today -> 18:00 tomorrow!
          hour = pmHour
          if (!dueDate || dueDate === todayStr) {
            finalDate = tomorrowStr
          }
        }
      }
    }

    // Check if the scheduled time is in the past for today (and user didn't specify a future date or recurring)
    const targetPassedToday = curHour > hour || (curHour === hour && curMin > min)
    if (targetPassedToday && (!dueDate || dueDate === todayStr) && !hasTomorrow) {
      // Time has already passed today -> schedule for tomorrow
      finalDate = tomorrowStr
    }

    finalTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  }

  return { dueDate: finalDate, dueTime: finalTime }
}

/**
 * Universal recipient cleaner and shared status extractor from text and LLM output
 */
export function extractCleanRecipientAndSharing(
  rawText: string,
  itemRecipientName?: string | null,
  itemIsBothShared?: boolean
): { recipientName: string | null; isBothShared: boolean } {
  let recName = itemRecipientName ? String(itemRecipientName).trim() : null
  const text = rawText || ''

  // Check if rawText contains "нам", "для нас", "общая", "совместная", "мне и", "нам с", "для меня и", "вместе", "обоим"
  const hasUsKeywords = /(?:^|[^а-яёa-z0-9])(?:нам|для\s+нас|вместе|обоим|общая|совместная|совместно|мне\s+и|нам\s+с|для\s+меня\s+и|с\s+нами)(?:[^а-яёa-z0-9]|$)/i.test(text)

  let isShared: boolean
  if (itemIsBothShared !== undefined) {
    isShared = Boolean(itemIsBothShared) || hasUsKeywords
  } else {
    isShared = hasUsKeywords
  }

  // Clean recName from "мне и X" / "нам с X" / "для меня и X"
  if (recName) {
    recName = recName
      .replace(/^(?:мне\s+и|нам\s+с|для\s+меня\s+и|для\s+нас\s+с|я\s+и|с\s+)\s+/i, '')
      .replace(/\s+(?:и\s+мне|и\s+я|со\s+мной|с\s+нами)$/i, '')
      .replace(/^(?:для|кому|другу|коллеге)\s+/i, '')
      .trim()
  }

  // If no recName was extracted by LLM, try regexes on rawText:
  if (!recName && text) {
    const patterns = [
      // "дай мне и вовчику береговому общую задачу поиграть..."
      // "создай нам с лерой задачу приготовить..."
      /(?:дай|поставь|создай|назначь|запиши|добавь|сделай)\s+(?:мне\s+и|нам\s+с|для\s+меня\s+и|для\s+нас\s+с)\s+([а-яёa-z0-9_@\s]+?)\s+(?:общую\s+задачу|совместную\s+задачу|общую|совместную|задачу|цель|дело|напоминание|поиграть|сделать|созвониться|встретиться|пойти)/i,
      // "общая задача мне и вове поиграть..."
      /(?:общая|совместная)\s+(?:задача|цель|дело)\s+(?:для\s+)?(?:меня\s+и\s+|нам\s+с\s+|мне\s+и\s+)?([а-яёa-z0-9_@\s]+?)(?:,|$|\s+по|\s+на|\s+в\s+\d|\s+чтобы|\s+поиграть|\s+сделать)/i,
      // "дай задачу вове позвонить..."
      /(?:дай\s+задачу|поручи\s+задачу|передай\s+задачу|отправь\s+задачу|назначь\s+задачу|скинь\s+задачу|кинь\s+задачу)\s+([а-яёa-z0-9_@\s]+?)(?:,|$|\s+чтобы|\s+на|\s+в\s+\d|\s+по|\s+сделать|\s+поиграть)/i,
      // "дай вове задачу..." / "поручи лере отчет..."
      /(?:дай|поручи|передай|отправь|назначь|скинь|кинь)\s+([а-яёa-z0-9_@\s]+?)\s+(?:задачу|цель|дело|сделать|поиграть|созвониться|купить|написать|проверить|подготовить|встретиться|пойти|отчет)/i,
      // "задача нам с лерой..."
      /задача\s+(?:нам\s+с|мне\s+и)\s+([а-яёa-z0-9_@\s]+?)(?:,|$|\s+по|\s+на|\s+в\s+\d|\s+чтобы)/i,
    ]

    for (const pat of patterns) {
      const m = text.match(pat)
      if (m && m[1]) {
        let candidate = m[1].trim()
        candidate = candidate
          .replace(/^(?:мне\s+и|нам\s+с|для\s+меня\s+и|для\s+нас\s+с)\s+/i, '')
          .replace(/\s+(?:общую|совместную|задачу|цель|дело)$/i, '')
          .trim()
        if (candidate && candidate.length <= 40) {
          recName = candidate
          break
        }
      }
    }
  }

  if (recName && (recName.toLowerCase() === 'мне' || recName.toLowerCase() === 'я' || recName.toLowerCase() === 'себе')) {
    recName = null
    isShared = false
  }

  return { recipientName: recName || null, isBothShared: Boolean(isShared) }
}

/**
 * Fuzzy similarity score between two strings (0–1)
 */
export function stringSimilarity(a: string, b: string): number {
  a = a.toLowerCase().trim()
  b = b.toLowerCase().trim()
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.9

  const aWords = new Set(a.split(/\s+/))
  const bWords = new Set(b.split(/\s+/))
  const intersection = [...aWords].filter(w => bWords.has(w)).length
  const union = new Set([...aWords, ...bWords]).size
  return intersection / union
}

/**
 * Generate a short 2-3 sentence motivational reminder context for a note/task.
 * Returns a ready-to-send Russian string.
 */
export async function generateReminderContext(
  noteTitle: string,
  noteContent: string,
  dueTime: string,
  apiKey?: string
): Promise<string> {
  try {
    const result = await callGroqChatCompletion({
      messages: [
        {
          role: 'system',
          content: `Ты — дружелюбный AI-ассистент. Напиши 2-3 предложения на РУССКОМ языке:
1. Приятное пожелание или напоминание о предстоящем событии
2. 1 практическую рекомендацию или совет
Стиль: тёплый, поддерживающий, конкретный. Без шаблонных фраз. Без упоминания «Zerf».
Ответь ТОЛЬКО этими 2-3 предложениями, без лишнего текста.`,
        },
        {
          role: 'user',
          content: `Событие/тема: «${noteTitle}»\nВремя: ${dueTime}\nКонтекст: ${noteContent.slice(0, 400)}`,
        },
      ],
      model: GROQ_CHAT_MODEL,
      temperature: 0.75,
      max_tokens: 200,
      apiKey,
    })
    return result.content?.trim() || `Напоминание: «${noteTitle}» в ${dueTime}. 🎯`
  } catch {
    return `Напоминание: «${noteTitle}» в ${dueTime}. Удачи! 🚀`
  }
}

/**
 * Generate a personalized morning greeting based strictly on user's own recent tasks, notes, and today's birthdays.
 * Returns a ready-to-send Russian Telegram message (with Markdown).
 */
export async function generateMorningGreeting(
  firstName: string,
  recentTaskTitles: string[],
  recentNoteTitles: string[],
  pendingTasks: string[],
  todayBirthdays: string[] = [],
  apiKey?: string
): Promise<string> {
  const now = new Date()
  const dayName = now.toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Moscow',
    weekday: 'long', day: 'numeric', month: 'long',
  })

  try {
    const contextLines: string[] = []
    if (todayBirthdays.length) contextLines.push(`Праздники и Дни рождения СЕГОДНЯ: ${todayBirthdays.join(', ')}`)
    if (pendingTasks.length) contextLines.push(`Планы и задачи на сегодня: ${pendingTasks.slice(0, 5).join(', ')}`)
    if (recentTaskTitles.length) contextLines.push(`Контекст недавних задач: ${recentTaskTitles.slice(0, 4).join(', ')}`)
    if (recentNoteTitles.length) contextLines.push(`Контекст заметок пользователя: ${recentNoteTitles.slice(0, 3).join(', ')}`)

    const result = await callGroqChatCompletion({
      messages: [
        {
          role: 'system',
          content: `Ты — персональный AI-ассистент пользователя в Telegram (Zerf AI). Каждое утро ты пишешь ему тёплое, вдохновляющее и строго персонализированное утреннее сообщение.
Формат ответа — Markdown для Telegram (жирный *текст*, курсив _текст_). Пиши ТОЛЬКО на русском языке.

Правила контекста (КРИТИЧЕСКИ ВАЖНО):
- Опирайся ИСКЛЮЧИТЕЛЬНО на предоставленные задачи, заметки и дни рождения ЭТОГО пользователя. НЕ выдумывай чужие задачи, людей или события, которых нет в контексте.
- Если список задач пуст: пожелай отличного свободного дня, предложи наметить главные цели или провести день с пользой.
- Дни рождения: упоминай день рождения ТОЛЬКО если он явно указан в строке «Праздники и Дни рождения СЕГОДНЯ». Если эта строка отсутствует или пуста, КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать о днях рождения, поздравлениях или праздниках!
- Задачи на сегодня — это планы, которые предстоит выполнить сегодня (НЕ пиши, что они уже сделаны).

Структура сообщения:
1. Приветствие с именем (1 строка, например: «Доброе утро, [Имя]!»)
2. Упоминание дня недели и даты (например: «Сегодня — [день], [дата].»)
3. Короткий персонализированный комментарий по его планам на сегодня (2-3 предложения, тепло, по-дружески).
4. 2 полезных практических совета для продуктивности или комфортного выполнения дел.
5. Короткая мотивирующая фраза на день.

Максимум 160 слов. Без шаблонности, конкретно и заботливо.`,
        },
        {
          role: 'user',
          content: `Имя пользователя: ${firstName}\nДата: ${dayName}\n${contextLines.length ? contextLines.join('\n') : 'Задач на сегодня нет, день полностью свободен.'}`,
        },
      ],
      model: GROQ_CHAT_MODEL,
      temperature: 0.7,
      max_tokens: 350,
      apiKey,
    })

    const aiText = result.content?.trim() || ''
    return aiText || buildFallbackGreeting(firstName, dayName, pendingTasks, todayBirthdays)
  } catch {
    return buildFallbackGreeting(firstName, dayName, pendingTasks, todayBirthdays)
  }
}

function buildFallbackGreeting(firstName: string, dayName: string, pendingTasks: string[], todayBirthdays: string[] = []): string {
  const bdayLine = todayBirthdays.length ? `🎂 *Праздники сегодня:*\n${todayBirthdays.map(b => `▪ ${b}`).join('\n')}\n\n` : ''
  return (
    `✦ *Доброе утро, ${firstName}!*\n\n` +
    `Сегодня ${dayName}.\n\n` +
    bdayLine +
    (pendingTasks.length
      ? `📋 *На сегодня (${pendingTasks.length}):*\n${pendingTasks.slice(0, 5).map(t => `▪ ${t}`).join('\n')}\n\n`
      : `✓ На сегодня задач нет — отличная возможность спланировать день!\n\n`) +
    `_Продуктивного дня! ✦_`
  )
}

/**
 * Generate personalized evening review at 21:00 MSK
 */
export async function generateEveningReview(
  firstName: string,
  completedTasks: string[],
  pendingTasks: string[],
  tomorrowTasks: string[] = [],
  apiKey?: string
): Promise<string> {
  try {
    const result = await callGroqChatCompletion({
      messages: [
        {
          role: 'system',
          content: `Ты — тактичный и умный вечерний ассистент Zerf AI. В 21:00 ты подводишь с пользователем итоги прошедшего дня в Telegram.
Пиши ТОЛЬКО на русском языке, в Markdown для Telegram (жирный **текст**, курсив _текст_).
Стиль: спокойный, лаконичный, поддерживающий.

СТРОГИЕ ПРАВИЛА (НЕ НАРУШАЙ НИ ПРИ КАКИХ УСЛОВИЯХ!):
1. ЧЁТКО РАЗДЕЛЯЙ ДНИ: СЕГОДНЯ и ЗАВТРА — это разные дни. Никогда не путай их!
2. НЕЗАКРЫТЫЕ ЗАДАЧИ ЗА СЕГОДНЯ:
   - Если за сегодня есть незакрытые задачи, ты ТОЛЬКО мягко напоминаешь о них или спрашиваешь: возможно пользователь уже выполнил их, но забыл отметить выполненными в приложении Zerf.
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО давать советы по сегодняшним невыполненным задачам!
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО переносить сегодняшние незакрытые задачи на завтра в тексте (например, если сегодня была задача "встреча с врачом", НЕЛЬЗЯ писать "завтра удачи у врача"!).
3. СОВЕТ И ЗАДАЧИ НА ЗАВТРА:
   - Блок «**Совет:**» строится ИСКЛЮЧИТЕЛЬНО на основе списка «ЗАПЛАНИРОВАНО НА ЗАВТРА» (если они есть).
   - Если на завтра есть задачи: дай 1 короткий практичный совет, как подготовиться ко сну и завтрашним делам.
   - Если на завтра задач нет (список пуст): дай нейтральный совет по вечернему отдыху, сну и восстановлению (без упоминания чужих или сегодняшних дел).

СТРУКТУРА СООБЩЕНИЯ:
1. Обращение по имени (например: «**Привет, [Имя]! 🌙**» или «**Добрый вечер, [Имя]! 🌙**»).
2. Итоги за СЕГОДНЯ:
   - Если были закрыты задачи: похвали за конкретно выполненные дела.
   - Если остались незакрытые задачи: мягко упомяни их списком («Остались незакрытыми: ... Возможно, ты уже всё сделал(а), но забыл(а) отметить галочкой в приложении»).
   - Если задач вообще не было: скажи, что день прошёл в спокойном ритме.
3. Блок «**Совет:**» — 1–2 предложения с рекомендацией на вечер/сон (строго с учётом задач на завтра, если они есть).

Максимум 110 слов. Без лишней воды.`,
        },
        {
          role: 'user',
          content: `Имя: ${firstName}\nВыполнено задач СЕГОДНЯ (${completedTasks.length}): ${completedTasks.slice(0, 5).join(', ') || 'нет'}\nОстались незакрытыми СЕГОДНЯ (${pendingTasks.length}): ${pendingTasks.slice(0, 5).join(', ') || 'все закрыты'}\nЗапланировано НА ЗАВТРА (${tomorrowTasks.length}): ${tomorrowTasks.slice(0, 5).join(', ') || 'нет конкретных задач на завтра'}`,
        },
      ],
      model: GROQ_CHAT_MODEL,
      temperature: 0.4,
      max_tokens: 300,
      apiKey,
    })

    const aiText = result.content?.trim() || ''
    return aiText || buildFallbackEveningReview(firstName, completedTasks, pendingTasks, tomorrowTasks)
  } catch {
    return buildFallbackEveningReview(firstName, completedTasks, pendingTasks, tomorrowTasks)
  }
}

function buildFallbackEveningReview(
  firstName: string,
  completedTasks: string[],
  pendingTasks: string[],
  tomorrowTasks: string[] = []
): string {
  let msg = `✦ **Добрый вечер, ${firstName}! 🌙**\n\n`
  if (completedTasks.length > 0) {
    msg += `✓ **Выполнено за сегодня (${completedTasks.length}):**\n` +
      completedTasks.slice(0, 5).map(t => `  ▫ ~${t}~`).join('\n') + `\n\n`
  } else {
    msg += `Сегодня не было отмечено выполненных задач.\n\n`
  }

  if (pendingTasks.length > 0) {
    msg += `⏱ **Остались незакрытыми за сегодня (${pendingTasks.length}):**\n` +
      pendingTasks.slice(0, 5).map(t => `  ▪ ${t}`).join('\n') + `\n` +
      `_Если вы их уже выполнили, не забудьте отметить галочкой в приложении._\n\n`
  } else {
    msg += `✦ **Все задачи за сегодня закрыты! Отличная работа.**\n\n`
  }

  if (tomorrowTasks.length > 0) {
    msg += `📅 **Планы на завтра (${tomorrowTasks.length}):**\n` +
      tomorrowTasks.slice(0, 3).map(t => `  ▫ ${t}`).join('\n') + `\n\n`
    msg += `**Совет:** отдохните вечером и выспитесь, чтобы завтра продуктивно закрыть запланированные дела.`
  } else {
    msg += `**Совет:** отложите телефон перед сном, выпейте тёплого чая или сделайте лёгкую растяжку, чтобы хорошо выспаться.`
  }

  return msg
}

export interface ReschedulePlanItem {
  id: string
  title: string
  oldTime: string | null
  newTime: string
  isTomorrow?: boolean
  reason: string
}

/**
 * Generate AI-powered smart rescheduling for overdue/pending tasks
 */
export async function generateSmartReschedulePlan(
  tasks: Array<{ id: string; title: string; priority: string; dueTime: string | null; dueDate: string | null }>,
  currentMskTime: string,
  apiKey?: string
): Promise<{ plan: ReschedulePlanItem[]; aiAdvice: string }> {
  if (!tasks || tasks.length === 0) {
    return { plan: [], aiAdvice: 'Нет активных задач для перепланирования.' }
  }

  const [curH, curM] = currentMskTime.split(':').map(n => parseInt(n, 10))
  const curTotalMin = (isNaN(curH) ? 14 : curH) * 60 + (isNaN(curM) ? 0 : curM)

  // Fallback heuristic if Groq fails or no key
  const fallbackPlan: ReschedulePlanItem[] = tasks.map((t, idx) => {
    const slotMin = curTotalMin + 30 + idx * 45
    const isTomorrow = slotMin >= 22 * 60 // After 22:00 -> move to tomorrow
    const normalizedMin = isTomorrow ? 10 * 60 + idx * 45 : slotMin
    const h = String(Math.floor(normalizedMin / 60) % 24).padStart(2, '0')
    const m = String(normalizedMin % 60).padStart(2, '0')
    return {
      id: t.id,
      title: t.title,
      oldTime: t.dueTime,
      newTime: `${h}:${m}`,
      isTomorrow,
      reason: isTomorrow ? 'Перенесено на завтра на утро' : 'Оптимальный интервал на сегодня'
    }
  })

  try {
    const result = await callGroqChatCompletion({
      messages: [
        {
          role: 'system',
          content: `Ты — умный AI-тайм-менеджер. Тебе дан список задач и текущее московское время (${currentMskTime}).
Распредели задачи по реалистичным слотам времени.
Правила:
- Срочные задачи (urgent/high) ставь раньше.
- Между задачами оставляй 30–60 минут.
- Если времени в сутках уже не хватает (после 22:00), переноси на завтра ("isTomorrow": true, начиная с 10:00).
- Верни СТРОГИЙ JSON формат:
{
  "aiAdvice": "Короткий совет (1-2 предложения) почему такой график оптимален",
  "plan": [
    {
      "id": "ID задачи",
      "newTime": "HH:MM",
      "isTomorrow": boolean,
      "reason": "краткая причина времени"
    }
  ]
}`
        },
        {
          role: 'user',
          content: JSON.stringify(tasks)
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      apiKey,
    })

    const parsed = JSON.parse(result.content || '{}')

    const plan: ReschedulePlanItem[] = (parsed.plan || []).map((p: any) => {
      const orig = tasks.find(t => t.id === p.id)
      return {
        id: p.id,
        title: orig?.title || 'Задача',
        oldTime: orig?.dueTime || null,
        newTime: p.newTime || '18:00',
        isTomorrow: !!p.isTomorrow,
        reason: p.reason || 'Оптимальное время'
      }
    })

    return {
      plan: plan.length > 0 ? plan : fallbackPlan,
      aiAdvice: parsed.aiAdvice || 'Расписание оптимизировано ИИ.'
    }
  } catch (err) {
    console.error('Smart reschedule error:', err)
    return {
      plan: fallbackPlan,
      aiAdvice: 'Задачи равномерно распределены по свободным интервалам.'
    }
  }
}

/**
 * Ultra-fast, low-latency intent parser tailored for Apple Siri, Action Button, and voice widgets.
 * Uses a concise 100-token prompt to avoid Groq TPM limits and completes in ~200-350ms.
 */
export async function parseSiriFastIntent(
  text: string,
  apiKey?: string,
  model = 'openai/gpt-oss-20b',
  friendsContext?: string,
  extensionsContext?: string
): Promise<ParsedItem[]> {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'

  const mskDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
  const mskTime = `${getPart('hour')}:${getPart('minute')}`

  let systemPrompt = `You are Zerf Note Siri Fast Parser. Output ONLY valid JSON.
Current Moscow Date: ${mskDate}, Time Right Now: ${mskTime} (MSK/UTC+3).

Schema:
{
  "items": [
    {
      "action": "create",
      "type": "task",
      "title": "Clean concise task title in Russian without command words",
      "dueTime": "HH:MM 24-hour format or null",
      "dueDate": "YYYY-MM-DD or null",
      "priority": "urgent" | "high" | "medium" | "low",
      "recipientName": null,
      "isBothShared": false,
      "repeat": "daily" | "weekdays" | "weekly" | "yearly" | null
    }
  ]
}

Rules:
1. Title MUST be in Russian.
2. Relative times ("через 10 минут", "в 18:00", "завтра в 9 утра", "будильник на 7:00") MUST be calculated relative to current Moscow time ${mskTime} on ${mskDate}.
3. If user says "поручи [Имя]..." -> "type": "delegate", "isBothShared": false, "recipientName": "[Имя]".
4. If user says "нам с [Имя] общая задача..." -> "type": "delegate", "isBothShared": true, "recipientName": "[Имя]".`

  if (extensionsContext) {
    systemPrompt += `\nExtensions Instructions:\n${extensionsContext}`
  }

  if (friendsContext) {
    systemPrompt += `\nFriends: ${friendsContext}`
  }

  try {
    const result = await callGroqChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      model,
      temperature: 0.1,
      max_tokens: 250,
      response_format: { type: 'json_object' },
      apiKey,
      fallbackModels: ['openai/gpt-oss-20b', 'qwen/qwen3.6-27b', 'llama-3.1-8b-instant']
    })

    const raw = result.content || '{}'
    let cleanRaw = raw.trim()
    if (cleanRaw.startsWith('```json')) cleanRaw = cleanRaw.replace(/^```json\s*/i, '')
    if (cleanRaw.startsWith('```')) cleanRaw = cleanRaw.replace(/^```\s*/i, '')
    if (cleanRaw.endsWith('```')) cleanRaw = cleanRaw.replace(/```\s*$/i, '')
    cleanRaw = cleanRaw.trim()

    const p = JSON.parse(cleanRaw)
    let rawItems = Array.isArray(p.items) && p.items.length > 0 ? p.items : [p]
    rawItems = rawItems.filter((item: any) => item && (item.title || item.action === 'delete_all'))
    if (rawItems.length === 0) return []

    return rawItems.map((item: any) => {
      const { recipientName: cleanRecName, isBothShared: cleanIsBothShared } = extractCleanRecipientAndSharing(
        text,
        item.recipientName,
        item.isBothShared
      )

      const effectiveType = (cleanRecName || item.type === 'delegate') ? 'delegate' : (item.type || 'task')

      return {
        action: item.action || 'create',
        targetId: item.targetId || null,
        type: effectiveType,
        title: item.title || text.slice(0, 50),
        summary: item.title || text,
        priority: item.priority || 'medium',
        dueDate: item.dueDate || null,
        dueTime: item.dueTime || null,
        daysCount: item.daysCount !== undefined ? Number(item.daysCount) : null,
        recipientName: cleanRecName,
        isBothShared: cleanIsBothShared,
        repeat: item.repeat || ((item.title || text).toLowerCase().match(/день рожд|др|праздник|годовщин/) ? 'yearly' : null),
        targetTitle: item.targetTitle || null,
        projectId: null,
        goalId: null,
        folder: null,
        members: null,
        tags: ['siri', 'быстрый ввод'],
        subtasks: [],
        milestones: [],
        motivation: null,
        rawText: text,
        originalText: text,
      }
    })
  } catch (err) {
    console.error('parseSiriFastIntent error:', err)
    return []
  }
}



