import { createServerFromRequest } from '@/lib/supabase/utils'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const importId = params.id

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

    const finalResponse = NextResponse.json({
      import: importRecord,
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
