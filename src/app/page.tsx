// src/app/page.tsx  (SERVER component wrapper)

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import Home from './HomePageClient';

export default function Page() {
  return <Home />;
}
