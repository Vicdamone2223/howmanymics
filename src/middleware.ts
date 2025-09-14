import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const CANONICAL = 'www.howmanymics.com'; // <- your canonical host

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  if (url.hostname === 'howmanymics.com') {
    url.hostname = CANONICAL;
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|robots.txt|sitemap.xml).*)'],
};
