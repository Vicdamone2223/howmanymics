// src/app/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-extrabold mb-2">Page not found</h1>
      <p className="opacity-80 mb-4">Sorry, we couldn’t find that page.</p>
      <Link href="/" className="underline">Go home</Link>
    </main>
  );
}
