import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import SocialEmbeds from '@/components/SocialEmbeds';
import AuthWatcher from '@/components/AuthWatcher';

export const metadata: Metadata = {
  title: 'How Many Mics',
  description: 'Hip-hop rankings, releases, and debates.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        <Header />
        {children}
        <SocialEmbeds />
        {/* Keep auth session fresh when returning to the tab */}
        <AuthWatcher />
      </body>
    </html>
  );
}
