import { createServerFromRequest } from '@/lib/supabase/utils'
import { processImport } from '@/lib/import';
import { NextResponse, type NextRequest } from 'next/server'
import { Buffer } from 'node:buffer';

/**
 * API Route para importação de arquivos Excel
 * 
 * IMPORTANTE: O body da request só pode ser lido UMA vez.
 * Use request.formData() apenas uma vez.
 */
export async function POST(request: NextRequest) {
  console.log('[API /api/import] Iniciando processamento...');
  
  try {
    // 1. Autenticação
    console.log('[API /api/import] Verificando autenticação...');
    const { supabase, response } = createServerFromRequest(request)
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      console.log('[API /api/import] Não autenticado');
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized',
          message: 'Você precisa estar autenticado para fazer importações'
        },
        { status: 401 }
      )
    }

    console.log('[API /api/import] Usuário autenticado:', session.user.id);

    // 2. Lê o FormData (APENAS UMA VEZ)
    console.log('[API /api/import] Lendo FormData...');
    const formData = await request.formData()
    const file = formData.get('file') as File | null;
    const storeId = formData.get('storeId') as string | null;
    const marketplace = formData.get('marketplace') as string | null;

    console.log('[API /api/import] Arquivo recebido:', file ? `${file.name} (${file.size} bytes)` : 'nenhum');
    console.log('[API /api/import] StoreId:', storeId);
    console.log('[API /api/import] Marketplace selecionado:', marketplace);

    // 3. Validações
    if (!file) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Nenhum arquivo enviado.',
          message: 'Por favor, selecione um arquivo para importar'
        },
        { status: 400 }
      );
    }

    // Valida extensão do arquivo
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Formato de arquivo inválido.',
          message: 'Por favor, envie um arquivo Excel (.xlsx ou .xls)'
        },
        { status: 400 }
      );
    }

    // Valida tamanho do arquivo (máximo 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Arquivo muito grande.',
          message: 'O arquivo deve ter no máximo 10MB'
        },
        { status: 400 }
      );
    }

    if (!storeId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Nenhum ID de loja fornecido.',
          message: 'Por favor, selecione uma loja'
        },
        { status: 400 }
      );
    }

    // 4. Converte arquivo para Buffer
    console.log('[API /api/import] Convertendo arquivo para Buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('[API /api/import] Buffer criado:', buffer.length, 'bytes');

    // 5. Processa a importação
    console.log('[API /api/import] Iniciando processamento da importação...');
    const result = await processImport(supabase, buffer, session.user.id, storeId, file.name, marketplace);
    console.log('[API /api/import] Processamento concluído:', result);

    // 6. Retorna resposta de sucesso (sempre JSON)
    const responseData = {
      success: result.success !== false,
      message: result.message || 'Importação concluída',
      marketplace: result.marketplace || 'desconhecido',
      marketplaceHint: marketplace, // Debug: marketplace selecionado pelo usuário
      orderCount: result.orderCount || 0,
      skipped: result.skipped || 0,
      totalProcessed: result.totalProcessed || 0,
    };
    
    console.log('[API /api/import] Retornando resposta de sucesso:', responseData);
    
    // Copia os cookies da resposta do Supabase
    const finalResponse = NextResponse.json(responseData, { status: 200 });
    response.cookies.getAll().forEach(cookie => {
      finalResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    
    return finalResponse;

  } catch (error: any) {
    // 7. Tratamento de erros (sempre retorna JSON)
    console.error('[API /api/import] ========== ERRO CAPTURADO ==========');
    console.error('[API /api/import] Mensagem:', error?.message);
    console.error('[API /api/import] Tipo:', typeof error);
    console.error('[API /api/import] Stack:', error?.stack);
    console.error('[API /api/import] Erro completo:', error);
    console.error('[API /api/import] =====================================');
    
    const errorMessage = error?.message || error?.toString() || 'Erro interno do servidor';
    
    const errorResponse = {
      success: false,
      error: errorMessage,
      message: `Erro ao processar importação: ${errorMessage}`,
      ...(process.env.NODE_ENV === 'development' && { 
        details: error?.stack,
        errorType: typeof error,
        errorName: error?.name,
      }),
    };
    
    console.log('[API /api/import] Retornando resposta de erro:', errorResponse);
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
