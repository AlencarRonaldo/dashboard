import { NextRequest, NextResponse } from 'next/server'
import { createServer } from '@/lib/supabase/server'
import { deleteUser, updateUserRole, getCurrentUserProfile } from '@/lib/supabase/admin'

interface RouteParams {
  params: Promise<{ id: string }>
}

// DELETE /api/admin/users/[id] - Deleta um usuário
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Verifica se está autenticado
    const supabase = await createServer()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Não permite deletar a si mesmo
    const currentUser = await getCurrentUserProfile()
    if (currentUser?.id === id) {
      return NextResponse.json(
        { error: 'Você não pode deletar sua própria conta' },
        { status: 400 }
      )
    }

    const result = await deleteUser(id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[DELETE /api/admin/users/[id]] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/users/[id] - Atualiza o role de um usuário
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { role } = body

    // Verifica se está autenticado
    const supabase = await createServer()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Validação do role
    if (!role || !['admin', 'user'].includes(role)) {
      return NextResponse.json(
        { error: 'Role deve ser "admin" ou "user"' },
        { status: 400 }
      )
    }

    const result = await updateUserRole(id, role)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[PATCH /api/admin/users/[id]] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    )
  }
}
