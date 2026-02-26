import React from 'react';

type SingleObj = { title: string; date?: string | null };

export default function AlbumBio({
  title = 'Album Info',
  overview,
  background,
  commercial,
  critical,
  singles = [],
}: {
  title?: string;
  overview?: string | null;
  background?: string | null;
  commercial?: string | null;
  critical?: string | null;
  singles?: SingleObj[] | string[] | null;
}) {
  const singlesNorm: SingleObj[] = (singles || []).map((s: any) =>
    typeof s === 'string' ? ({ title: s } as SingleObj) : s
  );

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-bold">{title}</h2>

      {overview && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold opacity-90">Overview</h3>
          <p className="leading-relaxed opacity-90 whitespace-pre-wrap">{overview}</p>
        </div>
      )}

      {background && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold opacity-90">Background / Creation</h3>
          <p className="leading-relaxed opacity-90 whitespace-pre-wrap">{background}</p>
        </div>
      )}

      {commercial && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold opacity-90">Commercial Success</h3>
          <p className="leading-relaxed opacity-90 whitespace-pre-wrap">{commercial}</p>
        </div>
      )}

      {critical && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold opacity-90">Critical Success</h3>
          <p className="leading-relaxed opacity-90 whitespace-pre-wrap">{critical}</p>
        </div>
      )}

      {singlesNorm.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold opacity-90">Singles</h3>
          <ul className="list-disc pl-6 space-y-1">
            {singlesNorm.map((s, i) => (
              <li key={`${s.title}-${i}`} className="opacity-90">
                {s.title}
                {s?.date ? <span className="opacity-70"> — {s.date}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
