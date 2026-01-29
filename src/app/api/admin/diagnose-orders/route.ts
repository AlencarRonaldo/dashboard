import { createServerFromRequest } from '@/lib/supabase/utils'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse, type NextRequest } from 'next/server'

// GET /api/admin/diagnose-orders - Diagnóstico dos pedidos
export async function GET(request: NextRequest) {
  const { supabase, response } = createServerFromRequest(request)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const userId = session.user.id
    const adminClient = createAdminClient()

    // Busca todos os marketplaces do banco
    const { data: allMarketplaces } = await adminClient
      .from('marketplaces')
      .select('id, name, display_name')

    // Busca as lojas do usuário
    const { data: stores } = await adminClient
      .from('stores')
      .select('id, name, marketplace_id, marketplaces:marketplace_id(id, name, display_name)')
      .eq('user_id', userId)

    const storeIds = (stores || []).map((s: any) => s.id)

    if (storeIds.length === 0) {
      return NextResponse.json({ stores: [], orders: [], imports: [] })
    }

    // Busca todos os pedidos com seus dados
    const { data: orders } = await adminClient
      .from('orders')
      .select('id, platform_order_id, external_order_id, platform_name, store_name, store_id, import_id, order_date')
      .in('store_id', storeIds)
      .order('order_date', { ascending: false })
      .limit(500)

    // Agrupa por platform_name
    const platformNameCounts: Record<string, number> = {}
    const storeIdCounts: Record<string, number> = {}
    const importIdCounts: Record<string, number> = {}

    ;(orders || []).forEach((order: any) => {
      const pn = order.platform_name || '(null)'
      platformNameCounts[pn] = (platformNameCounts[pn] || 0) + 1

      const sid = order.store_id || '(null)'
      storeIdCounts[sid] = (storeIdCounts[sid] || 0) + 1

      const iid = order.import_id || '(null)'
      importIdCounts[iid] = (importIdCounts[iid] || 0) + 1
    })

    // Busca imports
    const { data: imports } = await adminClient
      .from('imports')
      .select('id, file_name, status, created_at')
      .eq('user_id', userId)

    const finalResponse = NextResponse.json({
      totalOrders: orders?.length || 0,
      stores: stores || [],
      allMarketplaces: allMarketplaces || [],
      platformNameCounts,
      storeIdCounts,
      importIdCounts,
      imports: imports || [],
      sampleOrders: (orders || []).slice(0, 20).map((o: any) => ({
        id: o.id,
        platform_order_id: o.platform_order_id,
        platform_name: o.platform_name,
        store_id: o.store_id,
        import_id: o.import_id,
      })),
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

// DELETE /api/admin/diagnose-orders?import_id=xxx - Deleta por import_id
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
    const importId = searchParams.get('import_id')
    const userId = session.user.id

    if (!importId) {
      return NextResponse.json({ error: 'import_id é obrigatório' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Verifica se o import pertence ao usuário
    const { data: importRecord } = await adminClient
      .from('imports')
      .select('id, file_name')
      .eq('id', importId)
      .eq('user_id', userId)
      .single()

    if (!importRecord) {
      return NextResponse.json({ error: 'Import não encontrado' }, { status: 404 })
    }

    // Busca pedidos deste import
    const { data: orders } = await adminClient
      .from('orders')
      .select('id')
      .eq('import_id', importId)

    const orderIds = (orders || []).map(o => o.id)

    if (orderIds.length === 0) {
      return NextResponse.json({ success: true, deletedOrders: 0, message: 'Nenhum pedido encontrado para este import' })
    }

    // Deleta dados financeiros
    await adminClient
      .from('order_financials')
      .delete()
      .in('order_id', orderIds)

    // Deleta itens
    await adminClient
      .from('order_items')
      .delete()
      .in('order_id', orderIds)

    // Deleta pedidos
    await adminClient
      .from('orders')
      .delete()
      .eq('import_id', importId)

    // Deleta o import
    await adminClient
      .from('imports')
      .delete()
      .eq('id', importId)

    const finalResponse = NextResponse.json({
      success: true,
      deletedOrders: orderIds.length,
      message: `Deletados ${orderIds.length} pedidos do import "${importRecord.file_name}"`
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
