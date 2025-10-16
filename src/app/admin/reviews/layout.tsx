// This forces the entire /admin/reviews route to be dynamic
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function AdminReviewsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
