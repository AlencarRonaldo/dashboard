import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest, type NextResponse as NextServerResponse } from 'next/server';

/**
 * Cliente Supabase para ser usado no `middleware.ts` da aplicação Next.
 *
 * Ele garante que:
 * - Cookies de sessão sejam lidos e escritos corretamente
 * - RLS funcione com o usuário autenticado
 * - Redirecionamentos possam ser feitos com base na sessão
 */
export const createMiddlewareClient = (
  request: NextRequest,
  response: NextServerResponse
) => {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Atualiza o cookie na request e na response
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          // Remove o cookie na request e na response
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );
};

