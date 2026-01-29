import { createServerFromRequest } from '@/lib/supabase/utils'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse, type NextRequest } from 'next/server'

// DELETE /api/admin/clear-data - Deleta todos os pedidos do usuário ou de uma loja específica
export async function DELETE(request: NextRequest) {
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
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')
    const marketplace = searchParams.get('marketplace')
    const userId = session.user.id

    console.log('[Clear Data] Iniciando limpeza de dados...')
    console.log('[Clear Data] userId:', userId)
    console.log('[Clear Data] storeId:', storeId)
    console.log('[Clear Data] marketplace:', marketplace)

    // Usa cliente admin para bypass de RLS
    const adminClient = createAdminClient()

    // Busca as lojas do usuário
    let storeIds: string[] = []

    if (storeId) {
      // Verifica se a loja pertence ao usuário
      const { data: store } = await adminClient
        .from('stores')
        .select('id')
        .eq('id', storeId)
        .eq('user_id', userId)
        .single()

      if (store) {
        storeIds = [store.id]
      }
    } else if (marketplace) {
      // Busca lojas do marketplace específico
      const { data: marketplaceData } = await adminClient
        .from('marketplaces')
        .select('id, name')
        .eq('name', marketplace.toLowerCase())
        .single()

      console.log('[Clear Data] Marketplace encontrado:', marketplaceData)

      if (marketplaceData) {
        const { data: stores } = await adminClient
          .from('stores')
          .select('id, name')
          .eq('user_id', userId)
          .eq('marketplace_id', marketplaceData.id)

        console.log('[Clear Data] Lojas do marketplace:', stores)
        storeIds = (stores || []).map(s => s.id)
      }
    } else {
      // Busca todas as lojas do usuário
      const { data: stores } = await adminClient
        .from('stores')
        .select('id')
        .eq('user_id', userId)

      storeIds = (stores || []).map(s => s.id)
    }

    console.log('[Clear Data] Store IDs:', storeIds)

    if (storeIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Nenhuma loja encontrada para o marketplace especificado.',
        deletedOrders: 0
      })
    }

    // Busca todos os pedidos das lojas usando admin client
    const { data: orders, error: ordersQueryError } = await adminClient
      .from('orders')
      .select('id')
      .in('store_id', storeIds)

    if (ordersQueryError) {
      console.error('[Clear Data] Erro ao buscar pedidos:', ordersQueryError)
    }

    const orderIds = (orders || []).map(o => o.id)
    console.log('[Clear Data] Pedidos encontrados:', orderIds.length)

    if (orderIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum pedido encontrado para deletar.',
        deletedOrders: 0
      })
    }

    // Deleta em lotes de 50 para evitar timeout
    const BATCH_SIZE = 50
    let deletedCount = 0
    let errors: string[] = []

    for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
      const batch = orderIds.slice(i, i + BATCH_SIZE)

      // Deleta dados financeiros
      const { error: finError } = await adminClient
        .from('order_financials')
        .delete()
        .in('order_id', batch)

      if (finError) {
        console.error('[Clear Data] Erro ao deletar financials:', finError)
        errors.push(`Financials: ${finError.message}`)
      }

      // Deleta itens
      const { error: itemsError } = await adminClient
        .from('order_items')
        .delete()
        .in('order_id', batch)

      if (itemsError) {
        console.error('[Clear Data] Erro ao deletar items:', itemsError)
        errors.push(`Items: ${itemsError.message}`)
      }

      // Deleta pedidos
      const { error: ordersError } = await adminClient
        .from('orders')
        .delete()
        .in('id', batch)

      if (ordersError) {
        console.error('[Clear Data] Erro ao deletar orders:', ordersError)
        errors.push(`Orders: ${ordersError.message}`)
      } else {
        deletedCount += batch.length
      }

      console.log(`[Clear Data] Progresso: ${Math.min(i + BATCH_SIZE, orderIds.length)}/${orderIds.length}`)
    }

    // Deleta importações do usuário se deletou todos os pedidos
    if (!storeId && !marketplace) {
      const { error: importError } = await adminClient
        .from('imports')
        .delete()
        .eq('user_id', userId)

      if (importError) {
        console.error('[Clear Data] Erro ao deletar imports:', importError)
      }
    }

    const finalResponse = NextResponse.json({
      success: true,
      message: `${deletedCount} pedidos removidos.${errors.length > 0 ? ' Alguns erros: ' + errors.slice(0, 2).join(', ') : ''}`,
      deletedOrders: deletedCount,
      errors: errors.length > 0 ? errors : undefined
    })

    response.cookies.getAll().forEach(cookie => {
      finalResponse.cookies.set(cookie.name, cookie.value, cookie)
    })

    return finalResponse
  } catch (error: any) {
    console.error('[Clear Data] Erro:', error)
    return NextResponse.json(
      { error: error?.message || 'Erro ao limpar dados' },
      { status: 500 }
    )
  }
}
