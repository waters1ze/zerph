---
name: zerf-extension-builder
description: Comprehensive expert skill and instruction guide for creating 100% compliant, secure, and production-ready Zerf Note extensions, widgets, AI skills, CLI plugins, and templates from scratch.
---

# 🤖 Zerf Note Extension Builder — AI Agent Skill

## 🎯 Назначение навыка
Этот навык обучает ИИ-ассистента создавать полностью валидные, безопасные и готовые к публикации расширения, плагины и шаблоны для экосистемы **Zerf Note** (Web, Telegram Bot `@Zerph_bot`, Siri/Shortcuts, TUI CLI `zerf`).

---

## 🏗️ 1. Архитектура расширения

Расширение создаётся в отдельном независимом репозитории GitHub и состоит из:

```
my-zerf-extension/
├── zerf-extension.json    # ОБЯЗАТЕЛЬНО: Манифест расширения
├── index.js               # Опционально: Точка входа для TUI CLI (ESM)
├── README.md              # Документация для каталога расширений
└── package.json           # Зависимости (при необходимости)
```

---

## 📜 2. Стандартный манифест (`zerf-extension.json`)

Манифест должен строго соответствовать следующей JSON-схеме:

```json
{
  "name": "zerf-plugin-<slug>",
  "title": "Человекопонятное название",
  "version": "1.0.0",
  "description": "Краткое описание функций (до 200 символов)",
  "type": "widget | template | theme | integration | prompt",
  "category": "ИИ & Промпты | Продуктивность | Инженерия | Финансы | Утилиты | Шаблоны",
  "icon": "🔮",
  "author": "github_username",
  "minPlan": "free | plus | pro | corp",
  "price": 0,
  "isRunnable": true,
  "aiInstructions": "Системная инструкция для ИИ чата и Telegram-бота...",
  "triggers": ["/command", "ключевая фраза 1", "ключевая фраза 2"],
  "content": {
    "aiEndpoint": "https://your-api.com/v1/webhook",
    "aiEndpointSecret": "optional_secret_token",
    "features": ["feature_1", "feature_2"],
    "commands": [
      {
        "cmd": "/command",
        "description": "Описание команды"
      }
    ],
    "settingsSchema": [
      {
        "key": "apiKey",
        "label": "API Ключ",
        "type": "secret"
      },
      {
        "key": "limit",
        "label": "Лимит элементов",
        "type": "number",
        "defaultValue": 10
      }
    ]
  },
  "permissions": [
    "tasks:read",
    "tasks:write",
    "notes:read",
    "notes:write"
  ]
}
```

---

## 🔒 3. Требования безопасности и правила валидации

При генерации кода расширений ИИ обязан соблюдать следующие ограничения:
1. **Запрет Prompt Injection**: Поле `aiInstructions` не должно содержать попыток взлома системного контекста (`ignore previous instructions`, `jailbreak`, `DAN mode`).
2. **Зарезервированные команды**: Запрещено переопределять системные команды ядра: `/pay`, `/admin`, `/login`, `/logout`, `/start`, `/help`, `/sudo`.
3. **Безопасность URL**: Поле `content.aiEndpoint` должно быть только `https://`. Запрещены локальные хосты (`localhost`, `127.0.0.1`, приватные подсети `10.x`, `192.168.x`).
4. **Таймаут и объём**: Внешний вебхук должен укладываться в 8 секунд и отдавать не более 50 КБ JSON.
5. **Суточные лимиты на ИИ**:
   - Free: 10 запросов/день
   - Plus: 50 запросов/день
   - Pro: 150 запросов/день
   - Corp: 300 запросов/день

---

## 💻 4. Шаблон точки входа CLI (`index.js`)

Если расширение поддерживает TUI CLI Zerf, файл `index.js` должен экспортировать модуль формата ES Modules:

```javascript
export default {
  // Вызывается при запуске CLI
  async onLoad(ctx) {
    ctx.log.info('Расширение инициализировано');
  },

  // Вызывается при вводе команды расширения
  async onCommand(cmd, args, ctx) {
    const tasks = await ctx.api.getTasks();
    ctx.log.success(`Обработано задач: ${tasks.length}`);
  },

  // Вызывается при системных событиях
  async onHook(event, data, ctx) {
    if (event === 'task:completed') {
      ctx.log.info(`Завершена задача: ${data.title}`);
    }
  }
};
```

---

## 🧩 5. Готовые рецепты для ИИ-генерации

### Рецепт А: ИИ-Ассистент Исследований (AI Deep Research)
- **Type**: `widget`
- **Category**: `ИИ & Промпты`
- **Triggers**: `["/research", "исследуй тему", "найди факты"]`
- **aiInstructions**: `При запросе на исследование темы декомпозируй анализ на 3 доказанных тезиса с источниками и сформируй список задач в Zerf.`

### Рецепт Б: Синхронизация с GitHub / Jira
- **Type**: `integration`
- **Category**: `Инженерия`
- **Triggers**: `["/github", "/jira", "импортируй задачи"]`
- **SettingsSchema**: Поля `repoUrl`, `githubToken` (type: `secret`), `autoSync` (type: `boolean`).

### Рецепт В: Финансовый трекер и бюджет
- **Type**: `template`
- **Category**: `Финансы`
- **Triggers**: `["/finance", "расходы", "бюджет"]`
- **aiInstructions**: `Парси финансовые траты и доходы, структурируй в категории и веди баланс.`

---

## 💰 6. Монетизация
- Автор получает **80%** от каждой продажи платного расширения (при цене `price > 0`).
- Оплата покупателем производится через **ЮMoney** (карты, СБП).
- Вывод средств доступен от 100 ₽ через панель `/developer`.
