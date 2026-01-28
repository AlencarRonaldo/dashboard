import { createMiddlewareClient } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
  
  const supabase = createMiddlewareClient(request, response)
  
  // Usa getUser() que é mais seguro que getSession()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const protectedRoutes = ['/dashboard', '/import', '/history']
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route))

  // Se não está autenticado e tenta acessar rota protegida, redireciona para login
  if (!user && isProtectedRoute) {
    const url = new URL(request.url)
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Se está autenticado e tenta acessar login, redireciona para dashboard
  if (user && (pathname.startsWith('/auth/login') || pathname === '/login')) {
    const url = new URL(request.url)
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Redireciona raiz para dashboard (se autenticado) ou login (se não)
  if (pathname === '/') {
    const url = new URL(request.url)
    if (user) {
      url.pathname = '/dashboard'
    } else {
      url.pathname = '/login'
    }
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
