import { saveParsedItemToDb } from '../lib/backend/db'
import { parseIntentWithGroq } from '../lib/backend/groq'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const item = {
    action: "set_my_birthday",
    type: "reminder",
    title: "День рождения",
    summary: "Семилетия моей жизни",
    priority: "low",
    dueDate: "2010-04-03",
    repeat: "yearly",
    tags: [],
    subtasks: [],
    milestones: [],
    rawText: "мой др 03.04.2010"
  } as any

  console.log('saving to db...')
  try {
    const res = await saveParsedItemToDb(item, 419230553)
    console.log('res:', res)
  } catch (e) {
    console.error('ERROR:', e)
  }
  prisma.$disconnect()
}
main()
