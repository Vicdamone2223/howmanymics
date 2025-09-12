import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // Supabase sets cookies like: sb-<project>-auth-token / sb-...-refresh-token
  const hasSbAuth = req.cookies.getAll().some(
    c => c.name.startsWith('sb-') && c.name.includes('auth')
  );

  // Only touch page navigations (HTML), skip assets/APIs
  const accept = req.headers.get('accept') || '';
  const isHtmlNav = accept.includes('text/html');

  if (hasSbAuth && isHtmlNav) {
    const res = NextResponse.next();
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('Expires', '0');
    return res;
  }
  return NextResponse.next();
}

// Limit to your page routes (keeps _next static assets untouched)
export const config = {
  matcher: [
    '/',
    '/(articles|artist|release|debates|rankings|calendar|reviews|search)(.*)',
  ],
};
