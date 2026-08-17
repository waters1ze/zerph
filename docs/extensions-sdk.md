# 🛠 Zerf Note Extensions SDK — Исчерпывающее руководство разработчика

Добро пожаловать в официальную документацию по разработке расширений для экосистемы **Zerf Note** (Web, Telegram Bot, Siri/Shortcuts, TUI CLI).

---

## 📑 Содержание
1. [Архитектура расширений](#1-архитектура-расширений)
2. [Спецификация манифеста (`zerf-extension.json`)](#2-спецификация-манифеста-zerf-extensionjson)
3. [Система разрешений (Permissions)](#3-система-разрешений-permissions)
4. [Схема пользовательских настроек (Settings Schema)](#4-схема-пользовательских-настроек-settings-schema)
5. [Интеграция с ИИ: Промпты и Webhook API](#5-интеграция-с-ии-промпты-и-webhook-api)
6. [Разработка плагинов для CLI (`index.js`)](#6-разработка-плагинов-для-cli-indexjs)
7. [Лимиты и безопасность (SSRF & Rate Limits)](#7-лимиты-и-безопасность-ssrf--rate-limits)
8. [Монетизация и выплаты авторам (80/20)](#8-монетизация-и-выплаты-авторам-8020)
9. [Публикация и верификация](#9-публикация-и-верификация)

---

## 1. Архитектура расширений

Каждое расширение — это независимый репозиторий GitHub (или npm-пакет), содержащий декларативный манифест и опциональный исполняемый код:

```
my-zerf-extension/
├── zerf-extension.json    # ОБЯЗАТЕЛЬНО: Манифест расширения
├── index.js               # Опционально: Точка входа для TUI CLI (ESM)
├── README.md              # Документация и скриншоты для витрины
└── package.json           # Описание зависимостей (для npm-модулей)
```

Сервер Zerf Note считывает `zerf-extension.json` напрямую через GitHub Raw API при публикации. Приватный код платформы изолирован от расширений.

---

## 2. Спецификация манифеста (`zerf-extension.json`)

Полный пример манифеста:

```json
{
  "name": "zerf-plugin-research",
  "title": "Deep Research & Synthesizer",
  "version": "1.0.0",
  "description": "Автоматический поиск первоисточников, факт-чекинг и компиляция структурированных заметок.",
  "type": "widget",
  "category": "ИИ & Промпты",
  "icon": "🔮",
  "author": "developer_name",
  "minPlan": "plus",
  "price": 149,
  "isRunnable": true,
  "aiInstructions": "Когда пользователь просит исследовать тему или найти факты, структурируй ответ на 3 ключевых тезиса с цитатами и предложи создать задачи в Zerf Note.",
  "triggers": ["/research", "исследуй тему", "найди факты", "синтез"],
  "content": {
    "aiEndpoint": "https://api.yourdomain.com/v1/zerf-hook",
    "aiEndpointSecret": "optional_pre_shared_secret",
    "features": ["auto_notes", "sources_citations", "task_decomposition"],
    "commands": [
      {
        "cmd": "/research",
        "description": "Запустить глубокий анализ темы и синтез первоисточников"
      }
    ],
    "settingsSchema": [
      {
        "key": "apiKey",
        "label": "Секретный API-ключ сервиса",
        "description": "Ключ для доступа к вашему внешнему API",
        "type": "secret"
      },
      {
        "key": "maxSources",
        "label": "Максимум источников",
        "description": "Количество цитируемых статей (от 1 до 10)",
        "type": "number",
        "defaultValue": 5
      },
      {
        "key": "autoCreateTasks",
        "label": "Автосоздание задач",
        "description": "Превращать выводы исследования в задачи Zerf",
        "type": "boolean",
        "defaultValue": true
      },
      {
        "key": "depthLevel",
        "label": "Глубина исследования",
        "type": "select",
        "defaultValue": "deep",
        "options": [
          { "label": "Быстрый факт-чекинг", "value": "fast" },
          { "label": "Глубокий академический анализ", "value": "deep" }
        ]
      }
    ]
  },
  "permissions": [
    "tasks:read",
    "tasks:write",
    "notes:read",
    "notes:write",
    "ai:proxy"
  ]
}
```

### Таблица полей:

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `name` | `string` | Да | Уникальный ID в формате `zerf-plugin-*` (латиница, цифры, дефисы). |
| `title` | `string` | Да | Отображаемое название в каталоге (до 40 символов). |
| `version` | `string` | Да | Семантическая версия (напр. `1.0.0`). |
| `description` | `string` | Да | Краткое описание функционала (до 200 символов). |
| `type` | `string` | Да | `widget` (виджет), `template` (шаблон задач), `theme` (тема), `integration` (сервис), `prompt` (навык ИИ). |
| `category` | `string` | Да | `ИИ & Промпты`, `Продуктивность`, `Инженерия`, `Финансы`, `Утилиты`, `Шаблоны`. |
| `icon` | `string` | Да | Эмодзи (напр. `🔮`, `📊`, `⚡`) или URL на SVG-иконку. |
| `author` | `string` | Да | Имя или никнейм создателя. |
| `minPlan` | `string` | Нет | Мин. тариф: `free`, `plus` (99 ₽), `pro` (299 ₽), `corp`. По умолч. `free`. |
| `price` | `number` | Нет | Цена в рублях (0 = Бесплатно). При > 0 покупка проходит через ЮMoney. |
| `isRunnable` | `boolean` | Нет | `true`, если расширение имеет интерактивный запуск/команду. |
| `aiInstructions` | `string` | Нет | Системный промпт, автоматически внедряемый в ИИ чата и Telegram-бота. |
| `triggers` | `string[]` | Нет | Список ключевых фраз и слеш-команд для автоматической активации. |
| `content.aiEndpoint`| `string` | Нет | Защищённый `https://` URL вашего внешнего вебхука. |
| `content.settingsSchema`| `array` | Нет | Декларативная схема параметров, настраиваемых пользователем в UI. |
| `permissions` | `string[]` | Нет | Запрашиваемые права доступа. |

---

## 3. Система разрешений (Permissions)

Расширения объявляют необходимые права в массиве `permissions`:

| Право | Описание | Доступный контекст |
|---|---|---|
| `tasks:read` | Чтение списка задач пользователя | `ctx.api.getTasks()` / webhook context |
| `tasks:write` | Создание и обновление задач | `ctx.api.createTask()` / webhook `suggestedTasks` |
| `notes:read` | Чтение заметок базы знаний | `ctx.api.getNotes()` / webhook context |
| `notes:write` | Создание и сохранение заметок | `ctx.api.createNote()` / webhook `suggestedNotes` |
| `reminders:write`| Установка напоминаний | Создание системных алертов |
| `ai:proxy` | Проксирование запросов через Zerf AI Hub | Доступ к `POST /api/extensions/ai` |

---

## 4. Схема пользовательских настроек (Settings Schema)

Поле `content.settingsSchema` позволяет автоматически сгенерировать форму настроек в веб-интерфейсе Zerf Note (`Настройки` → `Расширения`):

### Поддерживаемые типы полей:
1. `boolean` — Переключатель (тумблер да/нет).
2. `string` — Текстовое поле.
3. `number` — Числовое поле с валидацией.
4. `select` — Выпадающий список с массивом `options: [{ label, value }]`.
5. `color` — Выбор HEX-цвета (`#RRGGBB`).
6. `secret` — Замаскированное поле для API-ключей и паролей (`••••••••`).

Значения автоматически сохраняются в локальном хранилище браузера и передаются в контекст расширения.

---

## 5. Интеграция с ИИ: Промпты и Webhook API

### Как работает интеграция:
1. Пользователь включает ваше расширение.
2. Текст из `aiInstructions` автоматически добавляется в системный контекст веб-чата, Telegram-бота (`@Zerph_bot`) и голосового помощника Siri.
3. При вводе триггера (напр. `/research квантовые компьютеры`) Zerf обращается к вашему `content.aiEndpoint`.

### Запрос от сервера Zerf к вашему `aiEndpoint`:
```http
POST https://api.yourdomain.com/v1/zerf-hook
Content-Type: application/json
User-Agent: Zerf-Extension-AI-Proxy/2.0
X-Zerf-Secret: your_pre_shared_secret
```

```json
{
  "userId": "u_a9f8b7c6",
  "message": "Исследуй применение квантовых вычислений в криптографии",
  "action": "research",
  "extensionId": "zerf-plugin-research",
  "context": {
    "plan": "plus",
    "timezone": "Europe/Moscow",
    "userSettings": {
      "maxSources": 5,
      "autoCreateTasks": true
    }
  }
}
```

### Ожидаемый ответ от вашего `aiEndpoint`:
```json
{
  "reply": "### 🔬 Квантовые вычисления в криптографии\n\nАлгоритм Шора позволяет факторизовать числа за полиномиальное время [1]...",
  "suggestedTasks": [
    "Изучить постквантовые алгоритмы Kyber и Dilithium",
    "Провести аудит текущих RSA-ключей"
  ],
  "suggestedNotes": [
    {
      "title": "Постквантовая криптография NIST 2026",
      "content": "Стандарты защиты данных от атак квантовых компьютеров..."
    }
  ],
  "sources": [
    {
      "title": "NIST Post-Quantum Cryptography Standardization",
      "url": "https://csrc.nist.gov/projects/post-quantum-cryptography"
    }
  ]
}
```

---

## 6. Разработка плагинов для CLI (`index.js`)

Для расширений терминального интерфейса Zerf TUI CLI (`zerf`) точка входа экспортирует объект с методами жизненного цикла:

```javascript
// index.js (ES Module)
export default {
  // Вызывается при запуске CLI
  async onLoad(ctx) {
    ctx.log.info('Плагин MyPlugin успешно загружен');
  },

  // Вызывается при вводе команды расширения в CLI
  async onCommand(cmd, args, ctx) {
    if (cmd === '/mycommand') {
      const tasks = await ctx.api.getTasks();
      ctx.log.success(`Найдено активных задач: ${tasks.length}`);
      
      const query = args.join(' ');
      if (query) {
        await ctx.api.createTask(`[Plugin] ${query}`, { priority: 'high' });
        ctx.log.success(`Задача создана: ${query}`);
      }
    }
  },

  // Обработчик системных хуков
  async onHook(event, data, ctx) {
    if (event === 'task:completed') {
      ctx.log.info(`Задача завершена: ${data.title}`);
    }
  }
};
```

### Объект контекста (`ctx`):
- `ctx.api.getTasks()`: `Promise<Task[]>` — получить список всех задач.
- `ctx.api.createTask(title, opts)`: `Promise<Task>` — создать новую задачу.
- `ctx.api.getNotes()`: `Promise<Note[]>` — получить заметки.
- `ctx.api.createNote(title, body)`: `Promise<Note>` — создать новую заметку.
- `ctx.config.get(key)` / `ctx.config.set(key, value)` — сохранение настроек плагина.
- `ctx.log.info(msg)` / `ctx.log.success(msg)` / `ctx.log.error(msg)` — форматированный вывод в консоль.

---

## 7. Лимиты и безопасность (SSRF & Rate Limits)

Платформа Zerf Note обеспечивает строгую изоляцию и защиту от злоупотреблений:

1. **Только HTTPS**: `http://` запросы отклоняются.
2. **SSRF Защита**: Все домены резолвятся через DNS. Локальные IP (`127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`, `169.254.0.0/16`, `::1`) жестко блокируются.
3. **Таймаут**: 8 секунд на выполнение запроса к `aiEndpoint`.
4. **Лимит размера**: до 50 КБ JSON-ответа.
5. **Суточные квоты на ИИ для защиты от абуза**:
   - Тариф **Free**: **10 запросов в день**.
   - Тариф **Plus**: **50 запросов в день**.
   - Тариф **Pro**: **150 запросов в день**.
   - Тариф **Corp**: **300 запросов в день**.
   - **Creator / Admin**: Безлимит.

---

## 8. Монетизация и выплаты авторам (80/20)

- **80% выручки** с каждой продажи расширения начисляется автору на внутренний баланс.
- **20%** составляет комиссия платформы за эквайринг, серверную инфраструктуру и хостинг.
- **Безопасная оплата**: Платежи осуществляются через официальный шлюз **ЮMoney** (с банковских карт РФ, СБП и кошельков).
- **Вывод средств**: Доступен в разделе `/developer` от **100 ₽** на карту РФ, СБП (по номеру телефона) или кошелёк ЮMoney.
- Комиссия шлюза выплат (3.5%) вычитается из суммы перевода, обеспечивая прозрачность расчетов.

---

## 9. Публикация и верификация

1. Создайте публичный репозиторий на GitHub с файлом `zerf-extension.json`.
2. Откройте [Zerf Developer Hub](/developer) или раздел **Магазин расширений** в приложении.
3. Вставьте ссылку на ваш GitHub репозиторий и нажмите **«Опубликовать»**.
4. Валидатор Zerf проверит манифест на отсутствие вредоносного кода и мгновенно добавит его в каталог!
