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
    // Busca todas as importações do usuário com contagem de pedidos
    const { data: imports, error: importsError } = await supabase
      .from('imports')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (importsError) {
      throw importsError
    }

    // Para cada importação, conta quantos pedidos foram importados
    const importsWithCount = await Promise.all(
      (imports || []).map(async (importRecord) => {
        const { count, error: countError } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('import_id', importRecord.id)

        return {
          ...importRecord,
          recordsCount: count || 0,
        }
      })
    )

    const finalResponse = NextResponse.json(
      { imports: importsWithCount },
      { status: 200 }
    )
    
    // Copia os cookies da resposta do Supabase
    response.cookies.getAll().forEach(cookie => {
      finalResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    
    return finalResponse;
  } catch (error: any) {
    console.error('Import API Error:', error)
    const errorMessage = error?.message || error?.toString() || 'Internal Server Error'
    return NextResponse.json(
      { 
        error: errorMessage,
        imports: [] // Retorna array vazio em caso de erro
      },
      { status: 500 }
    )
  }
}
