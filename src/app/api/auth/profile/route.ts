import { NextResponse } from 'next/server'
import { getCurrentUserProfile } from '@/lib/supabase/admin'

// GET /api/auth/profile - Obtém o perfil do usuário atual
export async function GET() {
  try {
    const profile = await getCurrentUserProfile()

    if (!profile) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    return NextResponse.json({ profile })
  } catch (error: any) {
    console.error('[GET /api/auth/profile] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    )
  }
}
