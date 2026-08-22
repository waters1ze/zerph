import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Integration tests for POST /api/tasks/smart-reschedule (audit finding H-4).
 * Old implementation invoked the Groq LLM BEFORE the auth check and accepted
 * unbounded task arrays — an unauthenticated cost-abuse vector.
 * Contract: auth first; hard cap on input size; DB writes scoped by owner.
 */

export const MAX_TASKS = 50

const { prismaMock, groqState, authState } = vi.hoisted(() => ({
  prismaMock: { task: { updateMany: vi.fn() } },
  groqState: { calls: 0 },
  authState: { user: null as null | { chatId: string; isRoot: boolean } },
}))

vi.mock('@/lib/backend/prisma', () => ({ prisma: prismaMock }))

vi.mock('@/lib/backend/groq-pool', () => ({
  callGroqChatCompletion: vi.fn(async () => {
    groqState.calls++
    return {
      content: JSON.stringify({
        rescheduled: [
          { id: 'task-1', dueDate: '2026-08-23', dueTime: '10:00', reason: 'перенесено' },
        ],
      }),
      model: 'test-model',
    }
  }),
}))

vi.mock('@/lib/backend/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/backend/auth')>()
  return {
    ...actual,
    getAuthenticatedUser: vi.fn(async () => authState.user),
  }
})

import { POST } from '@/app/api/tasks/smart-reschedule/route'
import { callGroqChatCompletion } from '@/lib/backend/groq-pool'

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/tasks/smart-reschedule', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const makeTasks = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `task-${i}`, title: `Task ${i}`, priority: 'medium' }))

beforeEach(() => {
  vi.clearAllMocks()
  groqState.calls = 0
  ;(callGroqChatCompletion as any).mockImplementation?.(async () => {
    groqState.calls++
    return {
      content: JSON.stringify({
        rescheduled: [{ id: 'task-1', dueDate: '2026-08-23', dueTime: '10:00', reason: 'r' }],
      }),
    }
  })
})

describe('POST /api/tasks/smart-reschedule — cost-abuse protection', () => {
  it('UNAUTHENTICATED request never reaches the LLM', async () => {
    authState.user = null

    const res = await POST(postReq({ tasks: makeTasks(3) }))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.ok).toBe(false)
    expect(groqState.calls).toBe(0)
    expect(prismaMock.task.updateMany).not.toHaveBeenCalled()
  })

  it('oversized task arrays are rejected before the LLM call', async () => {
    authState.user = { chatId: '424242', isRoot: false }

    const res = await POST(postReq({ tasks: makeTasks(MAX_TASKS + 1) }))
    const json = await res.json()

    expect(res.status).toBe(413)
    expect(json.ok).toBe(false)
    expect(groqState.calls).toBe(0)
  })

  it('empty task list is rejected without LLM invocation', async () => {
    authState.user = { chatId: '424242', isRoot: false }

    const res = await POST(postReq({ tasks: [] }))

    expect(res.status).toBe(400)
    expect(groqState.calls).toBe(0)
  })

  it('authenticated request within limits calls LLM once and scopes DB writes by owner', async () => {
    authState.user = { chatId: '424242', isRoot: false }
    prismaMock.task.updateMany.mockResolvedValue({ count: 1 })

    const res = await POST(postReq({ tasks: makeTasks(2) }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(groqState.calls).toBe(1)
    expect(prismaMock.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'task-1', ownerChatId: BigInt(424242) }),
      })
    )
  })

  it('malformed JSON body does not crash the handler or reach the LLM', async () => {
    authState.user = { chatId: '424242', isRoot: false }

    const req = new NextRequest('http://localhost/api/tasks/smart-reschedule', {
      method: 'POST',
      body: '{not-json',
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)

    expect([400, 401]).toContain(res.status)
    expect(groqState.calls).toBe(0)
  })

  it('LLM response items are filtered to id+dueDate before persisting', async () => {
    authState.user = { chatId: '424242', isRoot: false }
    ;(callGroqChatCompletion as any).mockResolvedValueOnce({
      content: JSON.stringify({
        rescheduled: [
          { id: 'bad-item' }, // no dueDate
          { dueDate: '2026-08-23' }, // no id
          { id: 'good-item', dueDate: '2026-08-23', dueTime: '09:00' },
        ],
      }),
    })

    await POST(postReq({ tasks: makeTasks(1) }))

    expect(prismaMock.task.updateMany.mock.calls.some((c: any[]) => c[0]?.where?.id === 'good-item')).toBe(true)
    expect(prismaMock.task.updateMany.mock.calls.some((c: any[]) => c[0]?.where?.id === 'bad-item')).toBe(false)
  })
})
