// Force /account route to be fully dynamic
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
