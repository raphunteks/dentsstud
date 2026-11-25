import { NextResponse, type NextRequest } from 'next/server';

/**
 * Strict authentication guard for DENTSWEB STUDIO web portal.
 * - Protected routes (/dashboard, /settings, /admin, etc.) strictly require session cookies.
 * - Unauthenticated users are redirected to /login with original destination saved in `next`.
 * - /login and /register are NEVER blocked by middleware, preventing any redirect loops.
 *   Real session verification for auto-login is handled by client React + API.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has('dw_sid') || req.cookies.has('dw_auth');
  const pathname = req.nextUrl.pathname;

  // Never intercept login or register in edge middleware
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/kelas/login') ||
    pathname.startsWith('/kelas/register')
  ) {
    return NextResponse.next();
  }

  // Protected routes: if no session cookie, redirect to appropriate login
  if (!hasSession) {
    const loginPath = pathname === '/kelas' || pathname.startsWith('/kelas/') ? '/kelas/login' : '/login';
    const loginUrl = new URL(loginPath, req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/create-content/:path*',
    '/progress/:path*',
    '/results/:path*',
    '/social/:path*',
    '/help/:path*',
    '/studio/:path*',
    '/styles/:path*',
    '/voices/:path*',
    '/kelas',
    '/kelas/:path*',
  ],
};
