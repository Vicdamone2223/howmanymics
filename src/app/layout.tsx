import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import SocialEmbeds from '@/components/SocialEmbeds';
import AuthGuard from '@/components/AuthGuard';

export const metadata: Metadata = {
  title: 'How Many Mics',
  description: 'Hip-hop rankings, releases, and debates.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        <AuthGuard>
          {/* Single source of truth for the header */}
          <Header />
          {children}
          {/* Sitewide X/Twitter & Instagram embed processors */}
          <SocialEmbeds />
        </AuthGuard>
      </body>
    </html>
  );
}
