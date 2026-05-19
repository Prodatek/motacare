import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ============================================================
// ROUTE PROTECTION MIDDLEWARE
//
// Runs on the edge before every request.
// Protected routes: /dashboard/**
// Auth routes: /login, /register (redirect to dashboard if logged in)
//
// Token check is lightweight — we only verify the token exists
// in the cookie/header, not its validity. The gateway and
// downstream services handle full JWT verification.
// ============================================================

const PROTECTED_ROUTES = ['/dashboard'];
const AUTH_ROUTES = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for refresh token presence (stored in localStorage by the client,
  // but we use a cookie as a signal for the middleware since middleware
  // runs on the server and can't access localStorage)
  const hasSession = request.cookies.has('mc_session');

  const isProtectedRoute = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  // Unauthenticated user trying to access dashboard → send to login
  if (isProtectedRoute && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user hitting login/register → send to dashboard
  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)',
  ],
};