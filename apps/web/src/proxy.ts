import { NextResponse, type NextRequest } from 'next/server';

/** Cheap gate: no session cookies → login. The API still authorizes every call server-side. */
export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has('dw_sid') || req.cookies.has('dw_auth');
  if (!hasSession) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*', '/admin/:path*', '/create-content/:path*', '/progress/:path*', '/results/:path*', '/help/:path*', '/studio/:path*', '/styles/:path*', '/voices/:path*'],
};
