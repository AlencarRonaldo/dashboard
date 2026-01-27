import { createServerFromRequest } from '@/lib/supabase/utils'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
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
    // Busca todas as lojas do usuário
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select(`
        id,
        name,
        marketplace_id,
        marketplaces:marketplace_id (
          name,
          display_name
        )
      `)
      .eq('user_id', session.user.id)

    if (storesError) {
      throw storesError
    }

    const finalResponse = NextResponse.json(
      { stores: stores || [] },
      { status: 200 }
    )
    
    // Copia os cookies da resposta do Supabase
    response.cookies.getAll().forEach(cookie => {
      finalResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    
    return finalResponse;
  } catch (error: any) {
    console.error('Stores API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
    // Lê o body apenas UMA vez
    const body = await request.json()
    const { name, marketplaceName } = body

    if (!name || !marketplaceName) {
      return NextResponse.json(
        { error: 'Nome da loja e marketplace são obrigatórios' },
        { status: 400 }
      )
    }

    // Busca o ID do marketplace
    const { data: marketplace, error: marketplaceError } = await supabase
      .from('marketplaces')
      .select('id')
      .eq('name', marketplaceName)
      .single()

    if (marketplaceError || !marketplace) {
      return NextResponse.json(
        { error: 'Marketplace não encontrado' },
        { status: 404 }
      )
    }

    // Cria a loja
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .insert({
        user_id: session.user.id,
        marketplace_id: marketplace.id,
        name: name,
      })
      .select()
      .single()

    if (storeError) {
      throw storeError
    }

    const finalResponse = NextResponse.json(
      { store },
      { status: 201 }
    )
    
    // Copia os cookies da resposta do Supabase
    response.cookies.getAll().forEach(cookie => {
      finalResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    
    return finalResponse;
  } catch (error: any) {
    console.error('Create Store API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
