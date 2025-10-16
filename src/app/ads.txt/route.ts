// src/app/ads.txt/route.ts
export const revalidate = 86400; // refresh daily

export async function GET() {
  const upstream = 'https://srv.adstxtmanager.com/19390/howmanymics.com';
  try {
    const res = await fetch(upstream, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const text = await res.text();
    return new Response(text, {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      status: 200,
    });
  } catch {
    // Fallback: serve empty file so crawlers at least get 200 text/plain
    return new Response('', {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      status: 200,
    });
  }
}
