import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import SessionWatch from '@/components/SessionWatch';

export const metadata: Metadata = {
  title: 'How Many Mics',
  description: 'Hip-hop rankings, releases, and debates.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        <Header />
        <AppErrorBoundary>
          {children}
        </AppErrorBoundary>
        <SessionWatch />
      </body>
    </html>
  );
}
