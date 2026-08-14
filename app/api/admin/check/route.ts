import { NextRequest, NextResponse } from 'next/server'
import { isCallerAdmin } from '@/lib/backend/admin'

export async function GET(req: NextRequest) {
  try {
    const { isAdmin, isRoot, callerChatId } = await isCallerAdmin(req)
    return NextResponse.json({
      isAdmin,
      isRoot,
      callerChatId,
    })
  } catch (err: unknown) {
    return NextResponse.json({ isAdmin: false, error: String(err) }, { status: 500 })
  }
}
