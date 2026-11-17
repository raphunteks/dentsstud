import { NextResponse, type NextRequest } from 'next/server';

/**
 * Strict authentication guard for DENTSWEB STUDIO web portal.
 * - Protected routes (/dashboard, /settings, /admin, etc.) strictly require active session cookies.
 * - Unauthenticated users are redirected to /login with original destination saved in `next`.
 * - Authenticated users visiting /login or /register are auto-redirected to /dashboard.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has('dw_sid') || req.cookies.has('dw_auth');
  const pathname = req.nextUrl.pathname;

  // Login page handling
  if (pathname.startsWith('/login')) {
    if (hasSession) {
      const next = req.nextUrl.searchParams.get('next');
      const destination = next && next.startsWith('/') && !next.startsWith('/login') ? next : '/dashboard';
      return NextResponse.redirect(new URL(destination, req.url));
    }
    return NextResponse.next();
  }

  // Register page handling
  if (pathname.startsWith('/register')) {
    if (hasSession) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // Protected routes: unauthenticated -> redirect to /login
  if (!hasSession) {
    const loginUrl = new URL('/login', req.url);
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
    '/help/:path*',
    '/studio/:path*',
    '/styles/:path*',
    '/voices/:path*',
    '/login',
    '/register',
  ],
};
