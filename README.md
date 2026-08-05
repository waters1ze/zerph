# Zerf — AI Personal Command Center

> Premium productivity app with voice AI, task management, goals, notes, and Telegram bot.

## Stack
- **Next.js 15** — web app
- **Groq Whisper** (`whisper-large-v3`) — voice transcription
- **Groq LLM** (`openai/gpt-oss-120b`) — AI intent extraction
- **Telegram Bot** — voice messages + commands + reminders
- **Local JSON DB** — zero-cost file-based persistence

---

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/waters1ze/zerph.git
cd zerph
npm install
```

### 2. Setup Environment
```bash
cp .env.example .env.local
# Edit .env.local — add your GROQ_API_KEY and TELEGRAM_BOT_TOKEN
```

Get keys for free:
- **Groq API Key** → [console.groq.com](https://console.groq.com) (free, no card)
- **Telegram Bot Token** → [@BotFather](https://t.me/BotFather) → `/newbot`

### 3. Run
```bash
# Terminal 1 — Web app
npm run dev

# Terminal 2 — Telegram Bot (separate process)
npx tsx server/bot.ts
```

App runs at **http://localhost:3000**  
Mini App at **http://localhost:3000/tg**

---

## Features

### Voice Commands (🎙️)
Say anything — Zerf AI structures it automatically:
- `"Buy groceries tomorrow"` → creates Task
- `"I want to lose 10kg in 3 months"` → creates Goal with milestones
- `"Meeting notes: discussed roadmap..."` → creates Note in markdown
- `"Task X is done"` → finds similar task and marks ✅
- `"Call client at 14:30"` → creates task with ⏰ reminder

### Telegram Bot Commands
| Command | Action |
|---------|--------|
| `/start` | Welcome + open Mini App |
| `/today` | Today's tasks |
| `/goals` | Active goals |
| `/notes` | Recent notes |
| `[voice message]` | AI processes and saves |
| `[text]` | AI intent detection |

### ⏰ Timed Reminders
- Say `"Do laundry at 18:00"` → bot sends TG notification at 18:00
- Scheduler runs every 60 seconds

### 📌 Notes with Original Text
- AI structures voice into beautiful Markdown document
- Click **"Original voice transcript"** to see raw text

---

## Free Hosting (Railway.app)

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add environment variables in Railway dashboard
4. Service 1: `npm run build && npm start` (web app)
5. Service 2: `npx tsx server/bot.ts` (Telegram bot)

**Cost: $0** (500 free hours/month)

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ | Groq AI key (voice + chat) |
| `TELEGRAM_BOT_TOKEN` | ✅ | Telegram bot token |
| `NEXT_PUBLIC_APP_URL` | Optional | Public URL for production |
| `TG_MINIAPP_URL` | Optional | Telegram Mini App URL |
