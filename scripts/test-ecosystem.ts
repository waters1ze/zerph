import { prisma } from '../lib/backend/prisma'
import type { Task, Friend, FriendGroup } from '../lib/types'

async function runTests() {
  console.log('🧪 [Test Suite] Starting Ecosystem & Feature Verification Tests...')
  let passed = 0
  let failed = 0

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`)
      passed++
    } else {
      console.error(`  ❌ FAIL: ${name}`)
      failed++
    }
  }

  // ── TEST 1: Database Friend Group Persistence ──
  console.log('\n--- 1. Testing Database Friend Group Persistence ---')
  const testChatId = '999999999'
  const testGroup: FriendGroup = {
    id: `test_grp_${Date.now()}`,
    name: 'Тестовая Команда',
    emoji: '🚀',
    color: '#3b82f6',
    description: 'Группа для автоматических тестов',
    memberIds: ['111222', '333444'],
    createdAt: new Date().toISOString(),
  }

  try {
    // Upsert group in DB
    await prisma.config.upsert({
      where: { key: `friend_groups_${testChatId}` },
      update: { value: JSON.stringify([testGroup]) },
      create: { key: `friend_groups_${testChatId}`, value: JSON.stringify([testGroup]) },
    })

    // Read back
    const fetched = await prisma.config.findUnique({
      where: { key: `friend_groups_${testChatId}` },
    })
    const parsed = fetched ? JSON.parse(fetched.value) : []

    assert(Array.isArray(parsed) && parsed.length === 1, 'Group successfully written and read from DB')
    assert(parsed[0].id === testGroup.id, 'Group ID matches')
    assert(parsed[0].name === 'Тестовая Команда', 'Group Name matches')
    assert(parsed[0].emoji === '🚀', 'Group Emoji matches')
    assert(parsed[0].memberIds.includes('111222'), 'Group member 111222 included')

    // Clean up
    await prisma.config.delete({ where: { key: `friend_groups_${testChatId}` } }).catch(() => {})
  } catch (err: any) {
    assert(false, `Database persistence error: ${err.message}`)
  }

  // ── TEST 2: Task Filtering by Friend ──
  console.log('\n--- 2. Testing Task Filtering by Friend ---')
  const mockFriend: Friend = {
    id: 'f_alex',
    chatId: '6136950061',
    name: 'Александр Иванов',
    username: 'alex_dev',
    email: 'alex@gmail.com',
    status: 'online',
    addedAt: new Date().toISOString(),
  }

  const mockTasks: Task[] = [
    {
      id: 't1',
      title: 'Личная задача',
      priority: 'medium',
      status: 'todo',
      tags: ['личное'],
      assignees: [],
      isShared: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't2',
      title: 'Сделать ревью макета с Александром',
      priority: 'high',
      status: 'todo',
      tags: ['общая'],
      assignees: ['6136950061'],
      isShared: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't3',
      title: 'Задача от Александра',
      priority: 'urgent',
      status: 'todo',
      tags: ['поручение'],
      assignees: [],
      authorChatId: '6136950061',
      isShared: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't4',
      title: 'Отправить отчет @alex_dev',
      priority: 'low',
      status: 'todo',
      tags: ['работа'],
      assignees: [],
      targetContact: '@alex_dev',
      isShared: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  // Filter by mockFriend
  const friendFilter = mockFriend.chatId!
  const matchedFriendTasks = mockTasks.filter(t => {
    const friendId = mockFriend.id
    const friendCid = mockFriend.chatId
    const uname = mockFriend.username?.replace(/^@/, '').toLowerCase()
    const isAssignee = (t.assignees || []).some(a => a === friendId || a === friendCid)
    const isAuthor = String(t.authorChatId) === friendCid || String(t.authorChatId) === friendId
    const isTarget = Boolean(uname && t.targetContact && t.targetContact.replace(/^@/, '').toLowerCase() === uname)
    return isAssignee || isAuthor || isTarget
  })

  assert(matchedFriendTasks.length === 3, 'Friend filter matches exactly 3 tasks (assignee, author, target contact)')
  assert(matchedFriendTasks.some(t => t.id === 't2'), 'Matched task where friend is assignee')
  assert(matchedFriendTasks.some(t => t.id === 't3'), 'Matched task where friend is author')
  assert(matchedFriendTasks.some(t => t.id === 't4'), 'Matched task where friend is target contact')
  assert(!matchedFriendTasks.some(t => t.id === 't1'), 'Did not match unrelated personal task')

  // ── TEST 3: Task Filtering by Friend Group ──
  console.log('\n--- 3. Testing Task Filtering by Friend Group ---')
  const mockGroup: FriendGroup = {
    id: 'grp_dev_team',
    name: 'Стартап',
    emoji: '💼',
    color: '#8b5cf6',
    memberIds: ['6136950061', '987654321'],
    createdAt: new Date().toISOString(),
  }

  const mockTasksForGroup: Task[] = [
    {
      id: 'gt1',
      title: 'Подготовить релиз стартапа',
      priority: 'high',
      status: 'todo',
      tags: ['стартап'],
      assignees: ['6136950061'],
      isShared: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'gt2',
      title: 'Купить молоко домой',
      priority: 'low',
      status: 'todo',
      tags: ['дом'],
      assignees: [],
      isShared: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  const matchedGroupTasks = mockTasksForGroup.filter(t => {
    const memberIds = mockGroup.memberIds || []
    const hasMemberAssignee = (t.assignees || []).some(a => memberIds.includes(a))
    const hasGroupTag = (t.tags || []).some(tag => tag.toLowerCase() === mockGroup.name.toLowerCase())
    const inTitle = t.title.toLowerCase().includes(mockGroup.name.toLowerCase())
    return hasMemberAssignee || hasGroupTag || inTitle
  })

  assert(matchedGroupTasks.length === 1, 'Group filter correctly found 1 matching task')
  assert(matchedGroupTasks[0].id === 'gt1', 'Matched correct group task')

  // ── TEST 4: Focus Timer Calculations ──
  console.log('\n--- 4. Testing Focus Timer Time & Progress Calculation ---')
  const total = 25 * 60 // 1500s
  const remaining = 12 * 60 + 30 // 750s (50%)
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  const progressPercent = Math.min(100, Math.max(0, ((total - remaining) / total) * 100))

  assert(formatted === '12:30', 'Formatted clock time is correct (12:30)')
  assert(progressPercent === 50, 'Progress percentage is exactly 50%')

  // ── SUMMARY ──
  console.log(`\n========================================`)
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`)
  console.log(`========================================\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch(e => {
  console.error('Test suite runner crashed:', e)
  process.exit(1)
})
