---
name: zerf-extension-builder
description: Comprehensive expert skill for creating 100% compliant, secure, and production-ready Zerf Note extensions, widgets, AI skills, CLI plugins, and templates from scratch.
---

# 🤖 Zerf Note Extension Builder — AI Agent Skill

## 🎯 Назначение навыка
Этот навык позволяет создавать валидные, функциональные и безопасные расширения для экосистемы **Zerf Note** (Web, Telegram Bot, Siri/Shortcuts, TUI CLI).

---

## 🏗️ Структура репозитория расширения

```
my-zerf-extension/
├── zerf-extension.json    # Манифест расширения (ОБЯЗАТЕЛЬНО)
├── index.js               # Точка входа для TUI CLI (опционально)
├── README.md              # Описание для витрины каталога
└── package.json           # Зависимости
```

---

## 📜 Спецификация `zerf-extension.json`

```json
{
  "name": "zerf-plugin-sample",
  "title": "Sample Extension",
  "version": "1.0.0",
  "description": "Описание возможностей расширения",
  "type": "widget",
  "category": "ИИ & Промпты",
  "icon": "⚡",
  "author": "your_nickname",
  "minPlan": "free",
  "price": 0,
  "isRunnable": true,
  "aiInstructions": "Инструкция для ИИ в чате и Telegram-боте при обращении к расширению.",
  "triggers": ["/sample", "триггерная фраза"],
  "content": {
    "aiEndpoint": "https://api.yourdomain.com/v1/webhook",
    "commands": [
      {
        "cmd": "/sample",
        "description": "Запустить команду"
      }
    ],
    "settingsSchema": [
      {
        "key": "apiKey",
        "label": "API Ключ",
        "type": "secret"
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

## 🔒 Безопасность и Лимиты
- **Только HTTPS**: `http://` запрещен.
- **SSRF Защита**: Обращение к локальным/приватным IP блокируется.
- **Суточные лимиты**: Free: 10/день, Plus: 50/день, Pro: 150/день, Corp: 300/день.
- **Монетизация**: 80% автору с покупок через ЮMoney, вывод от 100 ₽.
