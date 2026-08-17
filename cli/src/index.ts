#!/usr/bin/env node

import { Command } from 'commander'
import React from 'react'
import { render } from 'ink'
import open from 'open'
import { Repl } from './tui/Repl.js'
import {
  loadCredentials,
  saveCredentials,
  clearCredentials,
  startDeviceAuth,
  pollDeviceAuth,
  fetchUserData,
  mutateItem,
} from './api.js'
import { getZefFace, renderZefBanner } from './mascot.js'

const program = new Command()

program
  .name('zerf')
  .description('Zerf — второй мозг в терминале (Claude Code style CLI)')
  .version('1.0.0')

// Default action — Launch interactive REPL
program
  .action(async () => {
    const creds = loadCredentials()
    if (!creds.token) {
      console.log(`\n ${getZefFace('idle')}  \x1b[1m\x1b[38;2;255;255;255mДобро пожаловать в Zerf CLI!\x1b[0m`)
      console.log(`     \x1b[38;2;148;163;184mДля входа в аккаунт выполните:\x1b[0m \x1b[38;2;56;189;248mzerf login\x1b[0m\n`)
      return
    }

    render(React.createElement(Repl))
  })

// zerf login (Device Flow)
program
  .command('login')
  .description('Авторизация в Zerf через браузер (Device Code Flow)')
  .action(async () => {
    console.log(`\n ${getZefFace('thinking')}  \x1b[38;2;148;163;184mГенерирую код подключения к Zerf Note...\x1b[0m`)

    try {
      const { code, authUrl } = await startDeviceAuth()
      console.log(`\n     Код подтверждения: \x1b[1m\x1b[38;2;56;189;248m${code}\x1b[0m`)
      console.log(`     Ссылка для входа:  \x1b[4m\x1b[38;2;129;140;248m${authUrl}\x1b[0m\n`)

      try {
        await open(authUrl)
      } catch {}

      console.log('     Ожидаю подтверждения в браузере...')

      const startTime = Date.now()
      while (Date.now() - startTime < 300_000) {
        await new Promise(r => setTimeout(r, 2000))
        const res = await pollDeviceAuth(code)

        if (res.status === 'approved' && res.token) {
          saveCredentials({
            token: res.token,
            chatId: res.chatId,
            plan: res.plan,
          })
          console.log(`\n ${getZefFace('celebrate')}  \x1b[32mУспешно авторизовано! Добро пожаловать в Zerf.\x1b[0m`)
          console.log(`     Запустите \x1b[1m\x1b[38;2;56;189;248mzerf\x1b[0m для входа в REPL.\n`)
          return
        }

        if (res.status === 'rejected') {
          console.log(`\n ${getZefFace('alert')}  \x1b[31mЗапрос авторизации был отклонён.\x1b[0m\n`)
          return
        }
      }

      console.log('\n     Время ожидания истекло. Попробуйте снова: zerf login\n')
    } catch (err: any) {
      console.error('Ошибка входа:', err.message)
    }
  })

// zerf today
program
  .command('today')
  .description('Показать список дел и привычек на сегодня')
  .action(async () => {
    const creds = loadCredentials()
    try {
      const data = await fetchUserData(creds)
      if (data.allowed === false) {
        console.log(`\n ${getZefFace('alert')}  ${data.message}\n`)
        return
      }

      const todayStr = new Date().toISOString().slice(0, 10)
      const tasks = (data.tasks || []).filter((t: any) => !t.dueDate || t.dueDate.startsWith(todayStr))

      console.log(`\n` + renderZefBanner(data.user?.name || 'User', data.user?.plan || 'plus'))
      console.log(` ${getZefFace('idle')}  \x1b[1m\x1b[38;2;255;255;255mЗадачи на сегодня (${tasks.length}):\x1b[0m\n`)

      if (tasks.length === 0) {
        console.log('   \x1b[38;2;148;163;184mНа сегодня задач нет! Отличный день для отдыха.\x1b[0m\n')
      } else {
        tasks.forEach((t: any) => {
          const check = t.status === 'done' ? '\x1b[32m✔\x1b[0m' : '\x1b[90m○\x1b[0m'
          const title = t.status === 'done' ? `\x1b[90m\x1b[9m${t.title}\x1b[0m` : `\x1b[1m${t.title}\x1b[0m`
          const time = t.dueTime ? ` \x1b[36m(${t.dueTime})\x1b[0m` : ''
          console.log(`   ${check} ${title}${time}`)
        })
        console.log('')
      }
    } catch (err: any) {
      console.error(err.message)
    }
  })

// zerf add <task>
program
  .command('add <task...>')
  .description('Быстро добавить задачу с распознаванием даты и времени')
  .action(async (taskParts: string[]) => {
    const creds = loadCredentials()
    const taskText = taskParts.join(' ')
    try {
      await mutateItem(creds, {
        action: 'create',
        item: {
          title: taskText,
          type: 'task',
          priority: 'medium',
          rawText: taskText,
        }
      })
      console.log(`\n ${getZefFace('celebrate')}  \x1b[32m✔ задача «${taskText}» сохранена\x1b[0m\n`)
    } catch (err: any) {
      console.error('Ошибка сохранения:', err.message)
    }
  })

// zerf done <query>
program
  .command('done <query...>')
  .description('Завершить задачу по названию (нечёткий поиск)')
  .action(async (queryParts: string[]) => {
    const creds = loadCredentials()
    const query = queryParts.join(' ').toLowerCase()
    try {
      const data = await fetchUserData(creds)
      const tasks = data.tasks || []
      const match = tasks.find((t: any) => t.status !== 'done' && t.title.toLowerCase().includes(query))

      if (match) {
        await mutateItem(creds, { action: 'toggle_task', id: match.id })
        console.log(`\n ${getZefFace('celebrate')}  \x1b[32m✔ задача «${match.title}» закрыта!\x1b[0m\n`)
      } else {
        console.log(`\n ${getZefFace('alert')}  \x1b[31m✖ Задача не найдена по запросу: "${query}"\x1b[0m\n`)
      }
    } catch (err: any) {
      console.error(err.message)
    }
  })

// zerf habit
program
  .command('habit')
  .description('Трекер привычек с прогрессом и стриками')
  .action(async () => {
    const creds = loadCredentials()
    try {
      const data = await fetchUserData(creds)
      const habits = data.habits || []

      console.log(`\n ${getZefFace('idle')}  \x1b[1m\x1b[38;2;255;255;255mПривычки (${habits.length}):\x1b[0m\n`)
      if (habits.length === 0) {
        console.log('   \x1b[90mПривычки пока не настроены. Создайте их в боте или на сайте.\x1b[0m\n')
      } else {
        habits.forEach((h: any) => {
          const streak = h.streak || 0
          const bar = '█'.repeat(Math.min(streak, 10)) + '░'.repeat(Math.max(0, 10 - streak))
          console.log(`   \x1b[36m${h.title}\x1b[0m`)
          console.log(`   \x1b[33m[${bar}]\x1b[0m стрик ${streak} дн.\n`)
        })
      }
    } catch (err: any) {
      console.error(err.message)
    }
  })

// zerf whoami
program
  .command('whoami')
  .description('Показать текущий профиль, тариф и статистику')
  .action(async () => {
    const creds = loadCredentials()
    if (!creds.token) {
      console.log('Вы не авторизованы. Выполните: zerf login')
      return
    }
    try {
      const data = await fetchUserData(creds)
      console.log(`\n` + renderZefBanner(data.user?.name || 'User', data.user?.plan || 'plus'))
      console.log(`  Пользователь: \x1b[1m${data.user?.name}\x1b[0m (@${data.user?.username || 'no_uname'})`)
      console.log(`  Chat ID:      ${data.user?.chatId}`)
      console.log(`  Тариф:        \x1b[32m${data.user?.plan?.toUpperCase()}\x1b[0m`)
      console.log(`  Всего задач:  ${data.stats?.totalTasks || 0}`)
      console.log(`  Заметок:      ${data.stats?.totalNotes || 0}\n`)
    } catch (err: any) {
      console.error(err.message)
    }
  })

// zerf logout
program
  .command('logout')
  .description('Выйти из аккаунта и очистить токен на диске')
  .action(() => {
    clearCredentials()
    console.log(`\n ${getZefFace('idle')}  Вы вышли из аккаунта. Конфигурация очищена.\n`)
  })

program.parse(process.argv)
