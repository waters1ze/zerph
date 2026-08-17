# 🛠 Zerf Note Extensions SDK — Полная документация разработчика

Добро пожаловать в руководство по созданию расширений для **Zerf Note**!

Расширения Zerf позволяют создавать кастомные виджеты, интеграции, интерактивные ИИ-инструменты, команды для TUI CLI и навыки для Telegram-бота.

---

## 📋 1. Структура репозитория расширения

Каждое расширение — это стандартный репозиторий GitHub с файлом `zerf-extension.json` (или `manifest.json`) в корне:

```
my-zerf-extension/
├── zerf-extension.json    # Манифест расширения (ОБЯЗАТЕЛЬНО)
├── index.js               # Точка входа для CLI (опционально)
├── README.md              # Описание для каталога
└── package.json           # Зависимости
```

---

## ⚙️ 2. Спецификация манифеста (`zerf-extension.json`)

```json
{
  "name": "zerf-plugin-research",
  "title": "Deep Research Assistant",
  "version": "1.0.0",
  "description": "Автоматический поиск первоисточников и компиляция заметок.",
  "type": "widget",
  "category": "ИИ & Промпты",
  "icon": "🔮",
  "author": "your_username",
  "minPlan": "plus",
  "price": 0,
  "isRunnable": true,
  "aiInstructions": "Когда пользователь запрашивает исследование темы, структурируй вывод по 3 пунктам и предложи создать задачу.",
  "triggers": ["/research", "исследуй тему", "найди факты"],
  "content": {
    "aiEndpoint": "https://api.yourdomain.com/v1/zerf-hook",
    "features": ["auto_notes", "sources_citations"],
    "commands": [
      {
        "cmd": "/research",
        "description": "Запустить глубокий анализ темы"
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

### Поля манифеста:

| Поле | Тип | Описание |
|---|---|---|
| `name` | string | Уникальный системный идентификатор (напр. `zerf-plugin-weather`) |
| `title` | string | Отображаемое имя в каталоге |
| `type` | string | `widget`, `template`, `theme`, `integration`, `prompt` |
| `category` | string | `ИИ & Промпты`, `Продуктивность`, `Инженерия`, `Финансы`, `Утилиты` |
| `icon` | string | Эмодзи или SVG URL |
| `minPlan` | string | `free`, `plus`, `pro`, `corp` |
| `price` | number | Цена в рублях (0 = бесплатное, > 0 = платное) |
| `aiInstructions` | string | Системный промпт, автоматически добавляемый в ИИ-контекст пользователя |
| `triggers` | string[] | Ключевые фразы для активации через чат и Telegram-бота |
| `content.aiEndpoint` | string (HTTPS) | Внешний вебхук разработчика для обработки запросов |

---

## 🔒 3. Требования безопасности (SSRF Protection & AI Webhooks)

Все запросы к `content.aiEndpoint` проксируются сервером Zerf со следующими ограничениями:
1. **Только HTTPS**: `http://` запрещён.
2. **Защита от SSRF**: Обращения к локальным IP (`127.0.0.1`, `localhost`, `10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`, `169.254.0.0/16`, `::1`) блокируются на уровне DNS.
3. **Таймаут**: 8 секунд.
4. **Лимит ответа**: до 50 КБ JSON.
5. **Rate-limit**: 15 запросов в минуту на пользователя.

### Формат запроса от Zerf к вашему `aiEndpoint`:
```json
{
  "userId": "u_a1b2c3d4",
  "message": "Сравни архитектуру Transformers и Mamba",
  "action": "research",
  "extensionId": "ext_gh_...",
  "context": {
    "plan": "plus"
  }
}
```

### Ожидаемый ответ от вашего `aiEndpoint`:
```json
{
  "reply": "Результаты исследования...",
  "suggestedTasks": ["Изучить стейт-спейс модели", "Протестировать Mamba в PyTorch"],
  "sources": [
    { "title": "Mamba: Linear-Time Sequence Modeling", "url": "https://arxiv.org/abs/2312.00752" }
  ]
}
```

---

## ⌨️ 4. Разработка для CLI (`index.js`)

Если расширение поддерживает TUI CLI Zerf (`zerf`), создайте файл `index.js`:

```javascript
export default {
  // Вызывается при старте CLI
  async onLoad(ctx) {
    ctx.log.info('Расширение MyPlugin активировано!');
  },

  // Вызывается при вводе команды в терминале
  async onCommand(cmd, args, ctx) {
    if (cmd === '/mycommand') {
      const tasks = await ctx.api.getTasks();
      ctx.log.success(`Найдено ${tasks.length} активных задач.`);
    }
  },

  // Обработка системных событий
  async onHook(event, data, ctx) {
    if (event === 'task:completed') {
      ctx.log.info(`Задача завершена: ${data.title}`);
    }
  }
};
```

---

## 💰 5. Монетизация и выплаты авторам (80/20)

- **Доход автора**: **80%** от каждой продажи расширения.
- **Комиссия платформы**: 20%.
- **Безопасная оплата**: Покупки проходят через защищённый платёжный шлюз **ЮMoney**.
- **Вывод средств**: Доступен от 100 ₽ на Банковскую Карту (РФ), СБП (по номеру телефона) или ЮMoney кошелёк.
- Комиссия за вывод средств (3.5% шлюза выплат) прозрачно вычитается из выплаты автора, сохраняя баланс платформы.

---

## 🚀 6. Публикация в каталоге Zerf

1. Опубликуйте репозиторий на GitHub с файлом `zerf-extension.json`.
2. Перейдите в раздел **Магазин расширений** → нажмите **«Опубликовать расширение с GitHub»** (или откройте `/developer`).
3. Вставьте ссылку на GitHub репозиторий.
4. Zerf автоматически верифицирует манифест и добавит ваше расширение в витрину!
