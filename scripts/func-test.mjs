/**
 * Functional end-to-end test: CRUD, limits, payment activation, Siri.
 * Runs against a local `next start` server + the real Supabase DB.
 * Uses a dedicated test user (999000111) and cleans up after itself.
 */
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const BASE = process.env.BASE || 'http://localhost:3100'
const ADMIN_SECRET = process.env.ADMIN_SECRET
const YOO_SECRET = process.env.YOOMONEY_NOTIFICATION_SECRET
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TEST_CID = '999000111'

const p = new PrismaClient()
const today = new Date().toISOString().slice(0, 10)
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`) }
}
const retry = async (fn, n = 4) => {
  for (let i = 1; i <= n; i++) {
    try { return await fn() } catch (e) {
      if (i === n) throw e
      await new Promise(r => setTimeout(r, 3000))
    }
  }
}

function yoomoneyBody(label, amount, opId) {
  const fields = {
    notification_type: 'payment-confirm',
    operation_id: opId,
    amount,
    currency: '643',
    datetime: new Date().toISOString(),
    sender: '',
    codepro: 'false',
    label,
  }
  const checkString = `${fields.notification_type}&${fields.operation_id}&${fields.amount}&${fields.currency}&${fields.datetime}&${fields.sender}&${fields.codepro}&${YOO_SECRET}&${fields.label}`
  const sha1 = crypto.createHash('sha1').update(checkString).digest('hex')
  return new URLSearchParams({ ...fields, sha1_hash: sha1 }).toString()
}

async function main() {
  console.log(`\n=== Функциональный тест против ${BASE} ===\n`)

  // ── Setup: test user + session
  await retry(() => p.telegramChat.upsert({
    where: { chatId: BigInt(TEST_CID) },
    update: { plan: 'free', subscriptionExpiry: null },
    create: { chatId: BigInt(TEST_CID), firstName: 'FuncTest' },
  }))
  await retry(() => p.userSession.deleteMany({ where: { chatId: BigInt(TEST_CID) } }))
  const token = crypto.randomBytes(32).toString('hex')
  await retry(() => p.userSession.create({ data: { chatId: BigInt(TEST_CID), sessionToken: token, deviceName: 'FuncTest' } }))
  const H = { 'x-auth-token': token, 'Content-Type': 'application/json' }
  const api = async (path, opts = {}) => {
    const res = await fetch(BASE + path, { ...opts, headers: { ...H, ...(opts.headers || {}) } })
    const data = await res.json().catch(() => null)
    return { status: res.status, data }
  }
  ok('сессия тест-пользователя аутентифицируется', (await api('/api/tasks')).status === 200)

  // ── 1. CRUD
  console.log('\n— CRUD через БД —')
  let id
  { // task
    const c = await api('/api/tasks', { method: 'POST', body: JSON.stringify({ title: 'Тест задача', priority: 'high' }) })
    ok('задача: создана', c.status === 200 && c.data?.task?.id, c.data?.task?.id)
    id = c.data?.task?.id
    const g = await api('/api/tasks')
    ok('задача: в списке из БД', g.data?.tasks?.some(t => t.id === id))
    const u = await api('/api/tasks', { method: 'PATCH', body: JSON.stringify({ id, status: 'done' }) })
    ok('задача: обновление (done)', u.status === 200 && u.data?.task?.status === 'done')
    const d = await api(`/api/tasks?id=${id}&type=task`, { method: 'DELETE' })
    const inDb = await retry(() => p.task.findUnique({ where: { id } }))
    ok('задача: удалена из БД', d.status === 200 && !inDb)
  }
  { // note
    const c = await api('/api/tasks', { method: 'POST', body: JSON.stringify({ itemType: 'note', title: 'Тест заметка', content: 'тело' }) })
    ok('заметка: создана', c.status === 200 && c.data?.note?.id)
    const nid = c.data?.note?.id
    const u = await api('/api/tasks', { method: 'PATCH', body: JSON.stringify({ id: nid, itemType: 'note', content: 'обновлено' }) })
    ok('заметка: обновление', u.status === 200)
    await api(`/api/tasks?id=${nid}&type=note`, { method: 'DELETE' })
    ok('заметка: удалена из БД', !(await retry(() => p.note.findUnique({ where: { id: nid } }))))
  }
  { // goal
    const c = await api('/api/tasks', { method: 'POST', body: JSON.stringify({ itemType: 'goal', title: 'Тест цель' }) })
    ok('цель: создана', c.status === 200 && c.data?.goal?.id)
    const gid = c.data?.goal?.id
    const u = await api('/api/tasks', { method: 'PATCH', body: JSON.stringify({ id: gid, itemType: 'goal', progress: 50 }) })
    ok('цель: обновление (progress)', u.status === 200 && u.data?.goal?.progress === 50)
    await api(`/api/tasks?id=${gid}&type=goal`, { method: 'DELETE' })
    ok('цель: удалена из БД', !(await retry(() => p.goal.findUnique({ where: { id: gid } }))))
  }
  { // habit
    const c = await api('/api/tasks', { method: 'POST', body: JSON.stringify({ itemType: 'habit', title: 'Тест привычка', icon: '🔥' }) })
    ok('привычка: создана', c.status === 200 && c.data?.habit?.id)
    const hid = c.data?.habit?.id
    const g = await api('/api/tasks')
    ok('привычка: в списке из БД', g.data?.habits?.some(h => h.id === hid))
    const u = await api('/api/tasks', { method: 'PATCH', body: JSON.stringify({ id: hid, itemType: 'habit', streak: 3 }) })
    ok('привычка: обновление (streak)', u.status === 200 && u.data?.habit?.streak === 3)
    await api(`/api/tasks?id=${hid}&type=habit`, { method: 'DELETE' })
    ok('привычка: удалена из БД', !(await retry(() => p.habit.findUnique({ where: { id: hid } }))))
  }

  // ── 2. Лимиты free
  console.log('\n— Лимиты бесплатного тарифа —')
  const usage = await api('/api/subscription')
  ok('usage: тариф free', usage.data?.plan === 'free')
  ok('usage: заметки ∞', usage.data?.notes?.max === null || usage.data?.notes?.max === undefined || !Number.isFinite(usage.data?.notes?.max) || usage.data?.notes?.max >= 1e9, JSON.stringify(usage.data?.notes))
  ok('usage: Siri 10/день', usage.data?.siri?.max === 10)
  ok('usage: голос 60 сек/день', usage.data?.voice?.maxSeconds === 60)
  ok('usage: фото недоступны (0)', usage.data?.photos?.max === 0, String(usage.data?.photos?.max))

  // photo gate for free
  const fd = new FormData()
  fd.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }), 'test.jpg')
  const vision = await fetch(BASE + '/api/vision/tasks', { method: 'POST', headers: { 'x-auth-token': token }, body: fd })
  ok('фото: free получает 403 с апселлом', vision.status === 403)

  // goals limit
  await retry(() => p.config.deleteMany({ where: { key: `cnt_goal_${TEST_CID}_${today}` } }))
  const goalIds = []
  for (let i = 0; i < 5; i++) {
    const r = await api('/api/tasks', { method: 'POST', body: JSON.stringify({ itemType: 'goal', title: `Цель ${i + 1}` }) })
    if (r.data?.goal?.id) goalIds.push(r.data.goal.id)
  }
  const sixth = await api('/api/tasks', { method: 'POST', body: JSON.stringify({ itemType: 'goal', title: 'Цель 6' }) })
  ok('цели: 5 созданы', goalIds.length === 5)
  ok('цели: 6-я отклонена (лимит free)', sixth.status === 403 && sixth.data?.limitReached === true)

  // siri limit via counter
  await retry(() => p.config.upsert({
    where: { key: `cnt_siri_${TEST_CID}_${today}` },
    update: { value: '10' },
    create: { key: `cnt_siri_${TEST_CID}_${today}`, value: '10' },
  }))
  const siriKey = crypto.createHmac('sha256', BOT_TOKEN).update(TEST_CID).digest('hex').slice(0, 10)
  const siriBlocked = await fetch(`${BASE}/api/shortcuts?chatId=${TEST_CID}&key=${siriKey}&text=${encodeURIComponent('что на сегодня')}`)
  const siriBlockedBody = await siriBlocked.json().catch(() => ({}))
  ok('Siri: 11-й запрос отклонён с предложением Plus', siriBlocked.status === 403 && /Plus|Pro/.test(String(siriBlockedBody.spokenResponse || siriBlockedBody.error || '')))

  // siri auth
  const noKey = await fetch(`${BASE}/api/shortcuts?chatId=${TEST_CID}&text=test`)
  const wrongKey = await fetch(`${BASE}/api/shortcuts?chatId=${TEST_CID}&key=wrongkey99&text=test`)
  ok('Siri: без ключа — 403', noKey.status === 403)
  ok('Siri: с неверным ключом — 403', wrongKey.status === 403)

  // ── 3. Оплата (подписанный webhook)
  console.log('\n— Оплата: активация Premium через валидный webhook —')
  const pay = async (label, amount, opId) => fetch(BASE + '/api/payment/yoomoney', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: yoomoneyBody(label, amount, opId),
  })
  let r = await pay(`${TEST_CID}_plus30`, '99.00', 'TESTOP_local_1')
  ok('оплата Plus: webhook принят', r.status === 200)
  let chat = await retry(() => p.telegramChat.findUnique({ where: { chatId: BigInt(TEST_CID) } }))
  const plusExpiry = chat?.subscriptionExpiry
  ok('оплата Plus: тариф=plus', chat?.plan === 'plus')
  ok('оплата Plus: срок ≈30 дней', plusExpiry && (new Date(plusExpiry) - new Date()) / 86400000 > 29.9)

  // replay — не должен продлевать повторно
  r = await pay(`${TEST_CID}_plus30`, '99.00', 'TESTOP_local_1')
  chat = await retry(() => p.telegramChat.findUnique({ where: { chatId: BigInt(TEST_CID) } }))
  ok('оплата: повтор (replay) отклонён — срок не задвоен', chat?.subscriptionExpiry?.getTime() === plusExpiry?.getTime())

  // сумма ниже цены — игнор
  r = await pay(`${TEST_CID}_pro30`, '5.00', 'TESTOP_local_3')
  chat = await retry(() => p.telegramChat.findUnique({ where: { chatId: BigInt(TEST_CID) } }))
  ok('оплата: сумма ниже цены игнорируется', chat?.plan === 'plus' && chat?.subscriptionExpiry?.getTime() === plusExpiry?.getTime())

  // подделка подписи — 403
  const forged = await fetch(BASE + '/api/payment/yoomoney', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: yoomoneyBody(`${TEST_CID}_pro30`, '299.00', 'TESTOP_local_4').replace(/sha1_hash=[0-9a-f]+/, 'sha1_hash=deadbeef'),
  })
  ok('оплата: поддельная подпись — 403', forged.status === 403)

  // Pro активация
  r = await pay(`${TEST_CID}_pro30`, '299.00', 'TESTOP_local_5')
  chat = await retry(() => p.telegramChat.findUnique({ where: { chatId: BigInt(TEST_CID) } }))
  ok('оплата Pro: тариф=pro', chat?.plan === 'pro')

  // лимиты после оплаты
  const usage2 = await api('/api/subscription')
  const unlim = v => v === null || v === undefined || !Number.isFinite(v) || v >= 1e9
  ok('после оплаты: фото 10/день (pro ∞)', unlim(usage2.data?.photos?.max) || usage2.data?.photos?.max >= 10, String(usage2.data?.photos?.max))
  ok('после оплаты: цели ∞', unlim(usage2.data?.goals?.max))
  ok('после оплаты: тариф в профиле = pro', (await api('/api/telegram/user')).data?.plan === 'pro')

  // ── 4. Siri happy path (реальный запрос с ключом)
  console.log('\n— Siri: рабочий запрос —')
  await retry(() => p.config.deleteMany({ where: { key: `cnt_siri_${TEST_CID}_${today}` } }))
  const siriOk = await fetch(`${BASE}/api/shortcuts?chatId=${TEST_CID}&key=${siriKey}&text=${encodeURIComponent('купить тестовое молоко в 19:30')}`)
  const siriOkBody = await siriOk.json().catch(() => ({}))
  const siriTask = await retry(() => p.task.findFirst({ where: { ownerChatId: BigInt(TEST_CID) }, orderBy: { createdAt: 'desc' } }))
  ok('Siri: запрос с ключом обработан', siriOk.status === 200 && Boolean(siriOkBody.success))
  ok('Siri: задача создана в БД из распознанного текста', Boolean(siriTask), siriTask?.title || '')

  console.log(`\n=== ИТОГО: ${pass} ✅ / ${fail} ❌ ===\n`)
  process.exitCode = fail ? 1 : 0
}

// cleanup in a finally-style handler
process.on('exit', async () => {
  try {
    await p.task.deleteMany({ where: { ownerChatId: BigInt(TEST_CID) } })
    await p.note.deleteMany({ where: { ownerChatId: BigInt(TEST_CID) } })
    await p.goal.deleteMany({ where: { ownerChatId: BigInt(TEST_CID) } })
    await p.habit.deleteMany({ where: { ownerChatId: BigInt(TEST_CID) } })
    await p.userSession.deleteMany({ where: { chatId: BigInt(TEST_CID) } })
    await p.telegramChat.deleteMany({ where: { chatId: BigInt(TEST_CID) } })
    await p.config.deleteMany({ where: { OR: [{ key: { startsWith: `cnt_${TEST_CID}_` } }, { key: { startsWith: 'yoomoney_op_TESTOP' } }] } })
    await p.$disconnect()
    console.log('(тестовые данные удалены, база чистая)')
  } catch { /* best effort */ }
})

main().catch(async e => {
  console.error('FATAL:', e.message)
  process.exitCode = 1
})
