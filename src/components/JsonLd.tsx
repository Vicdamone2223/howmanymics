// src/components/JsonLd.tsx
export default function JsonLd({ children }: { children: string }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: children }} />;
}
