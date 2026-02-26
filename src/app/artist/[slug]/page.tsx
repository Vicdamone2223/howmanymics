// src/app/artist/[slug]/page.tsx
import { use } from "react";
import PageClient from "./PageClient";

export default function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return <PageClient slug={slug} />;
}
