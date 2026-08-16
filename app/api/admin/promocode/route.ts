import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { isCallerAdmin } from '@/lib/backend/admin'

// GET /api/admin/promocode - list all promo codes
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await isCallerAdmin(req)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const promoCodes = await prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ promoCodes })
  } catch (error: any) {
    console.error('Error fetching promo codes:', error)
    return NextResponse.json({ error: error.message || 'Ошибка загрузки промокодов' }, { status: 500 })
  }
}

// POST /api/admin/promocode - create new promo code
export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await isCallerAdmin(req)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const body = await req.json()
    const {
      code,
      discountPercent = 100,
      targetPlan = 'all',
      durationDays = 30,
      maxActivations = 1,
      expiresAt,
    } = body

    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'Укажите код промокода' }, { status: 400 })
    }

    const cleanCode = code.trim().toUpperCase()

    // Check duplicate
    const existing = await prisma.promoCode.findUnique({
      where: { code: cleanCode },
    })

    if (existing) {
      return NextResponse.json({ error: 'Промокод с таким кодом уже существует' }, { status: 400 })
    }

    let parsedExpiry: Date | null = null
    if (expiresAt) {
      const d = new Date(expiresAt)
      if (!isNaN(d.getTime())) {
        parsedExpiry = d
      }
    }

    const newPromo = await prisma.promoCode.create({
      data: {
        code: cleanCode,
        discountPercent: Math.min(100, Math.max(1, Number(discountPercent) || 100)),
        targetPlan: targetPlan || 'all',
        durationDays: Math.max(1, Number(durationDays) || 30),
        maxActivations: Math.max(1, Number(maxActivations) || 1),
        expiresAt: parsedExpiry,
        usedByChatIds: [],
        isActive: true,
      },
    })

    return NextResponse.json({ success: true, promoCode: newPromo })
  } catch (error: any) {
    console.error('Error creating promo code:', error)
    return NextResponse.json({ error: error.message || 'Ошибка создания промокода' }, { status: 500 })
  }
}

// DELETE /api/admin/promocode - delete or deactivate promo code
export async function DELETE(req: NextRequest) {
  try {
    const { isAdmin } = await isCallerAdmin(req)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID промокода не передан' }, { status: 400 })
    }

    await prisma.promoCode.deleteMany({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting promo code:', error)
    return NextResponse.json({ error: error.message || 'Ошибка удаления промокода' }, { status: 500 })
  }
}
