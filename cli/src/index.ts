#!/usr/bin/env node

import { Command } from 'commander'
import React from 'react'
import { render } from 'ink'
import open from 'open'
import { App } from './tui/App.js'
import {
  loadConfig,
  saveConfig,
  clearConfig,
  requestAuthCode,
  pollAuthStatus,
  fetchUserData,
  mutateItem,
  generateExtensionViaAi,
  DEFAULT_API_URL
} from './api.js'
import { renderMascotWithBubble, getAllayAscii } from './mascot.js'

const program = new Command()

program
  .name('zerf')
  .description('Zerf Note — Terminal Productivity & Second Brain Assistant')
  .version('1.0.0')

// Default action — Launch interactive TUI Dashboard
program
  .action(async () => {
    const config = loadConfig()
    if (!config.token) {
      console.log(renderMascotWithBubble('Привет! Для начала работы с Zerf CLI выполните вход через команду: zerf login', 'idle'))
      return
    }

    render(React.createElement(App))
  })

// zerf login
program
  .command('login')
  .description('Авторизация в Zerf Note через веб-браузер')
  .action(async () => {
    console.log(renderMascotWithBubble('Генерирую код подключения к вашему аккаунту Zerf Note...', 'thinking'))

    try {
      const { code, authUrl } = await requestAuthCode()
      console.log(`\n\x1b[1m\x1b[38;2;56;189;248mВаш код подтверждения: \x1b[38;2;251;191;36m${code}\x1b[0m\n`)
      console.log(`Открываю страницу подтверждения в браузере:`)
      console.log(`\x1b[4m\x1b[38;2;129;140;248m${authUrl}\x1b[0m\n`)

      try {
        await open(authUrl)
      } catch {}

      console.log('Ожидаю подтверждения в браузере...')

      // Poll status
      const startTime = Date.now()
      while (Date.now() - startTime < 300_000) { // 5 mins timeout
        await new Promise(r => setTimeout(r, 2000))
        const res = await pollAuthStatus(code)

        if (res.status === 'approved' && res.token) {
          saveConfig({
            token: res.token,
            chatId: res.chatId,
            plan: res.plan,
          })
          console.log('\n' + renderMascotWithBubble('Ура! Авторизация успешна. Добро пожаловать в Zerf CLI!', 'celebrate'))
          console.log('\nЗапустите \x1b[1m\x1b[38;2;56;189;248mzerf\x1b[0m для входа в панель управления.\n')
          return
        }

        if (res.status === 'rejected') {
          console.log('\n' + renderMascotWithBubble('Авторизация была отклонена.', 'alert'))
          return
        }
      }

      console.log('Время ожидания истекло. Попробуйте еще раз: zerf login')
    } catch (err: any) {
      console.error('Ошибка входа:', err.message)
    }
  })

// zerf today
program
  .command('today')
  .description('Показать список задач на сегодня')
  .action(async () => {
    const config = loadConfig()
    try {
      const data = await fetchUserData(config)
      if (data.allowed === false) {
        console.log(renderMascotWithBubble(data.message, 'alert'))
        return
      }

      const todayStr = new Date().toISOString().slice(0, 10)
      const tasks = (data.tasks || []).filter((t: any) => !t.dueDate || t.dueDate.startsWith(todayStr))

      console.log(`\n\x1b[1m\x1b[38;2;56;189;248m📋 Задачи на сегодня (${tasks.length}):\x1b[0m\n`)
      if (tasks.length === 0) {
        console.log('  \x1b[90mНа сегодня задач нет!\x1b[0m\n')
      } else {
        tasks.forEach((t: any, idx: number) => {
          const check = t.status === 'done' ? '\x1b[32m[✔]\x1b[0m' : '\x1b[90m[ ]\x1b[0m'
          const title = t.status === 'done' ? `\x1b[90m\x1b[9m${t.title}\x1b[0m` : `\x1b[1m${t.title}\x1b[0m`
          const time = t.dueTime ? ` \x1b[36m(${t.dueTime})\x1b[0m` : ''
          console.log(`  ${check} ${title}${time}`)
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
  .description('Добавить новую задачу с распознаванием даты и времени')
  .action(async (taskParts: string[]) => {
    const config = loadConfig()
    const taskText = taskParts.join(' ')
    try {
      const res = await mutateItem(config, {
        action: 'create',
        item: {
          title: taskText,
          type: 'task',
          priority: 'medium',
          rawText: taskText,
        }
      })
      console.log(renderMascotWithBubble(`Задача сохранена: "${taskText}"`, 'celebrate'))
    } catch (err: any) {
      console.error('Ошибка сохранения:', err.message)
    }
  })

// zerf extension <prompt>
program
  .command('extension <prompt...>')
  .description('Сгенерировать новое расширение с помощью ИИ-движка')
  .action(async (promptParts: string[]) => {
    const config = loadConfig()
    const prompt = promptParts.join(' ')
    console.log(renderMascotWithBubble(`Генерирую расширение для: "${prompt}"...`, 'thinking'))

    try {
      const res = await generateExtensionViaAi(config, prompt)
      console.log('\n' + renderMascotWithBubble(`Расширение «${res.extension?.manifest?.name || 'Новое'}» успешно создано!`, 'celebrate'))
      console.log(JSON.stringify(res.extension?.manifest, null, 2))
    } catch (err: any) {
      console.error('Ошибка генерации расширения:', err.message)
    }
  })

// zerf whoami
program
  .command('whoami')
  .description('Показать текущего пользователя и статус подписки')
  .action(async () => {
    const config = loadConfig()
    if (!config.token) {
      console.log('Вы не авторизованы. Запустите: zerf login')
      return
    }
    try {
      const data = await fetchUserData(config)
      console.log(`\n\x1b[1m\x1b[38;2;56;189;248m✦ Zerf Note CLI Status:\x1b[0m`)
      console.log(`  Пользователь: \x1b[1m${data.user?.name}\x1b[0m (@${data.user?.username || 'no_uname'})`)
      console.log(`  Chat ID: ${data.user?.chatId}`)
      console.log(`  Тариф: \x1b[32m${data.user?.plan?.toUpperCase()}\x1b[0m`)
      console.log(`  Задач всего: ${data.stats?.totalTasks || 0}`)
      console.log(`  Заметок: ${data.stats?.totalNotes || 0}\n`)
    } catch (err: any) {
      console.error(err.message)
    }
  })

// zerf logout
program
  .command('logout')
  .description('Выйти из аккаунта и очистить токен')
  .action(() => {
    clearConfig()
    console.log(renderMascotWithBubble('Вы вышли из аккаунта. Конфигурация очищена.', 'idle'))
  })

program.parse(process.argv)
