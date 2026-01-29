import { createServerFromRequest } from '@/lib/supabase/utils'
import { NextResponse, type NextRequest } from 'next/server'

// DELETE /api/imports/[id] - Deleta uma importação e todos os dados relacionados
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, response } = createServerFromRequest(request)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { id } = await params
    const importId = id

    // Verifica se a importação existe e pertence ao usuário
    const { data: importRecord, error: importError } = await supabase
      .from('imports')
      .select('id')
      .eq('id', importId)
      .eq('user_id', session.user.id)
      .single()

    if (importError || !importRecord) {
      return NextResponse.json(
        { error: 'Importação não encontrada' },
        { status: 404 }
      )
    }

    // Busca os IDs dos pedidos desta importação
    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('import_id', importId)

    const orderIds = (orders || []).map(o => o.id)

    // Deleta em cascata: financials -> items -> orders -> import
    if (orderIds.length > 0) {
      // Deleta dados financeiros dos pedidos
      await supabase
        .from('order_financials')
        .delete()
        .in('order_id', orderIds)

      // Deleta itens dos pedidos
      await supabase
        .from('order_items')
        .delete()
        .in('order_id', orderIds)

      // Deleta os pedidos
      await supabase
        .from('orders')
        .delete()
        .eq('import_id', importId)
    }

    // Deleta a importação
    const { error: deleteError } = await supabase
      .from('imports')
      .delete()
      .eq('id', importId)

    if (deleteError) {
      console.error('Erro ao deletar importação:', deleteError)
      return NextResponse.json(
        { error: 'Erro ao deletar importação: ' + deleteError.message },
        { status: 500 }
      )
    }

    const finalResponse = NextResponse.json({
      success: true,
      message: `Importação deletada com sucesso. ${orderIds.length} pedidos removidos.`
    }, { status: 200 })

    // Copia os cookies da resposta do Supabase
    response.cookies.getAll().forEach(cookie => {
      finalResponse.cookies.set(cookie.name, cookie.value, cookie);
    });

    return finalResponse
  } catch (error: any) {
    console.error('Import Delete API Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Erro interno ao deletar importação' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, response } = createServerFromRequest(request)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { id } = await params
    const importId = id

    // Busca os detalhes da importação
    const { data: importRecord, error: importError } = await supabase
      .from('imports')
      .select('*')
      .eq('id', importId)
      .eq('user_id', session.user.id)
      .single()

    if (importError || !importRecord) {
      return NextResponse.json(
        { error: 'Importação não encontrada' },
        { status: 404 }
      )
    }

    // Conta os pedidos importados
    const { count: ordersCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('import_id', importId)

    // Busca IDs dos pedidos desta importação
    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('import_id', importId)

    // Busca estatísticas financeiras
    let totals = { totalRevenue: 0, totalProfit: 0, totalOrders: ordersCount || 0 }
    
    if (orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id)
      const { data: financials } = await supabase
        .from('order_financials')
        .select('order_value, revenue, profit')
        .in('order_id', orderIds)

      if (financials) {
        totals = financials.reduce(
          (acc, f) => {
            acc.totalRevenue += Number(f.revenue || f.order_value || 0)
            acc.totalProfit += Number(f.profit || 0)
            return acc
          },
          { totalRevenue: 0, totalProfit: 0, totalOrders: ordersCount || 0 }
        )
      }
    }

    // Transforma snake_case para camelCase para corresponder à interface do frontend
    const transformedImport = {
      id: importRecord.id,
      date: importRecord.created_at,
      fileName: importRecord.file_name || '',
      status: importRecord.status,
      recordsCount: ordersCount || 0,
      errorDetails: importRecord.error_details || null,
      finishedAt: importRecord.finished_at || null,
      marketplace: undefined, // Não existe na tabela imports
    }

    const finalResponse = NextResponse.json({
      import: transformedImport,
      statistics: {
        ordersCount: ordersCount || 0,
        totalRevenue: totals.totalRevenue,
        totalProfit: totals.totalProfit,
      },
    }, { status: 200 })
    
    // Copia os cookies da resposta do Supabase
    response.cookies.getAll().forEach(cookie => {
      finalResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    
    return finalResponse;
  } catch (error: any) {
    console.error('Import Detail API Error:', error)
    const errorMessage = error?.message || error?.toString() || 'Internal Server Error'
    return NextResponse.json(
      { 
        error: errorMessage,
        import: null,
        statistics: { ordersCount: 0, totalRevenue: 0, totalProfit: 0 }
      },
      { status: 500 }
    )
  }
}
