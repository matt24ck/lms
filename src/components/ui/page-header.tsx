export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="eyebrow text-crimson mb-2">{eyebrow}</p>
        ) : null}
        <h1 className="display-3">{title}</h1>
        {description ? (
          <p className="text-ink-muted mt-2 max-w-2xl text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-3">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-line bg-surface/40 rounded-[12px] border border-dashed p-10 text-center">
      <p className="font-display text-ink font-extrabold tracking-[0.04em] uppercase">
        {title}
      </p>
      {description ? (
        <p className="text-ink-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
