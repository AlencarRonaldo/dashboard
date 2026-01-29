import { NextRequest, NextResponse } from 'next/server'
import { createServer } from '@/lib/supabase/server'
import { listAllUsers, createUser } from '@/lib/supabase/admin'

// GET /api/admin/users - Lista todos os usuários
export async function GET() {
  try {
    // Verifica se está autenticado
    const supabase = await createServer()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const users = await listAllUsers()
    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('[GET /api/admin/users] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    )
  }
}

// POST /api/admin/users - Cria um novo usuário
export async function POST(request: NextRequest) {
  try {
    // Verifica se está autenticado
    const supabase = await createServer()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { email, password, name, role } = body

    // Validações
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, senha e nome são obrigatórios' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      )
    }

    if (role && !['admin', 'user'].includes(role)) {
      return NextResponse.json(
        { error: 'Role deve ser "admin" ou "user"' },
        { status: 400 }
      )
    }

    const result = await createUser({
      email,
      password,
      name,
      role: role || 'admin'
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      user: result.user
    })
  } catch (error: any) {
    console.error('[POST /api/admin/users] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    )
  }
}
