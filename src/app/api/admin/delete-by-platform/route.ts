import { createServerFromRequest } from '@/lib/supabase/utils'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse, type NextRequest } from 'next/server'

// GET /api/admin/delete-by-platform - Lista pedidos por platform_name
export async function GET(request: NextRequest) {
  const { supabase, response } = createServerFromRequest(request)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const platformName = searchParams.get('platform_name') || 'Mercado'
    const userId = session.user.id

    const adminClient = createAdminClient()

    // Busca as lojas do usuário
    const { data: stores } = await adminClient
      .from('stores')
      .select('id, name, marketplace_id')
      .eq('user_id', userId)

    const storeIds = (stores || []).map(s => s.id)

    if (storeIds.length === 0) {
      return NextResponse.json({ orders: [], count: 0 })
    }

    // Busca pedidos com platform_name contendo o termo
    const { data: orders, error } = await adminClient
      .from('orders')
      .select('id, platform_order_id, external_order_id, platform_name, store_id, order_date')
      .in('store_id', storeIds)
      .ilike('platform_name', `%${platformName}%`)

    if (error) {
      console.error('Erro ao buscar pedidos:', error)
      throw error
    }

    const finalResponse = NextResponse.json({
      orders: orders || [],
      count: orders?.length || 0,
      message: `Encontrados ${orders?.length || 0} pedidos com platform_name contendo "${platformName}"`
    })

    response.cookies.getAll().forEach(cookie => {
      finalResponse.cookies.set(cookie.name, cookie.value, cookie)
    })

    return finalResponse
  } catch (error: any) {
    console.error('Erro:', error)
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 })
  }
}

// DELETE /api/admin/delete-by-platform - Deleta pedidos por platform_name
export async function DELETE(request: NextRequest) {
  const { supabase, response } = createServerFromRequest(request)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const platformName = searchParams.get('platform_name') || 'Mercado'
    const userId = session.user.id

    console.log('[Delete by Platform] Iniciando...')
    console.log('[Delete by Platform] platform_name:', platformName)

    const adminClient = createAdminClient()

    // Busca as lojas do usuário
    const { data: stores } = await adminClient
      .from('stores')
      .select('id')
      .eq('user_id', userId)

    const storeIds = (stores || []).map(s => s.id)

    if (storeIds.length === 0) {
      return NextResponse.json({ success: true, deletedOrders: 0, message: 'Nenhuma loja encontrada' })
    }

    // Busca pedidos com platform_name contendo o termo
    const { data: orders, error: findError } = await adminClient
      .from('orders')
      .select('id, platform_order_id')
      .in('store_id', storeIds)
      .ilike('platform_name', `%${platformName}%`)

    if (findError) {
      throw findError
    }

    const orderIds = (orders || []).map(o => o.id)
    console.log(`[Delete by Platform] Encontrados ${orderIds.length} pedidos para deletar`)

    if (orderIds.length === 0) {
      return NextResponse.json({
        success: true,
        deletedOrders: 0,
        message: `Nenhum pedido encontrado com platform_name contendo "${platformName}"`
      })
    }

    // Deleta dados financeiros
    const { error: finError } = await adminClient
      .from('order_financials')
      .delete()
      .in('order_id', orderIds)

    if (finError) {
      console.error('Erro ao deletar financials:', finError)
    }

    // Deleta itens
    const { error: itemsError } = await adminClient
      .from('order_items')
      .delete()
      .in('order_id', orderIds)

    if (itemsError) {
      console.error('Erro ao deletar items:', itemsError)
    }

    // Deleta pedidos
    const { error: ordersError } = await adminClient
      .from('orders')
      .delete()
      .in('store_id', storeIds)
      .ilike('platform_name', `%${platformName}%`)

    if (ordersError) {
      console.error('Erro ao deletar orders:', ordersError)
      throw ordersError
    }

    console.log(`[Delete by Platform] ✅ ${orderIds.length} pedidos deletados`)

    const finalResponse = NextResponse.json({
      success: true,
      deletedOrders: orderIds.length,
      message: `${orderIds.length} pedidos com platform_name "${platformName}" foram deletados`
    })

    response.cookies.getAll().forEach(cookie => {
      finalResponse.cookies.set(cookie.name, cookie.value, cookie)
    })

    return finalResponse
  } catch (error: any) {
    console.error('Erro:', error)
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 })
  }
}
