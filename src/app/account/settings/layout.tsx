// This forces the entire /account/settings route to be dynamic
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function AccountSettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
