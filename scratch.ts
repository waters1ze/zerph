import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function test() {
  const f = await prisma.friendship.findFirst()
  console.log(f)
}
test()
