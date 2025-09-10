export function Section({ title, actionHref, actionLabel, children }:{
  title: string; 
  actionHref?: string; 
  actionLabel?: string; 
  children: React.ReactNode 
}){
  return (
    <section className="py-6 sm:py-8">
      <div className="flex items-end justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight">{title}</h2>
        {actionHref && actionLabel && (
          <a 
            href={actionHref} 
            className="text-sm opacity-80 hover:opacity-100 underline underline-offset-4">
              {actionLabel}
          </a>
        )}
      </div>
      {children}
    </section>
  );
}
