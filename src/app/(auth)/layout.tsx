export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_minmax(420px,520px)]">
      <section className="hidden flex-col justify-between border-r border-border bg-surface p-12 lg:flex">
        <p className="text-lg font-semibold">Full-Stack Academy</p>
        <div className="max-w-md">
          <p className="text-4xl font-semibold leading-tight tracking-tight">
            Two requests reserve the last item at the same time. What stops you overselling?
          </p>
          <p className="mt-4 text-muted">
            Practise the questions backend interviews actually ask — with quizzes that adapt to what you get wrong and reviews
            timed to just before you forget.
          </p>
        </div>
        <p className="text-sm text-muted">168 questions across 22 backend topics.</p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </main>
  );
}
