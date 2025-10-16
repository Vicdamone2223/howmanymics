import PageClient from "./PageClient";

export default function Page({ params }: any) {
  const { slug } = (params ?? {}) as { slug: string };
  return <PageClient slug={slug} />;
}
