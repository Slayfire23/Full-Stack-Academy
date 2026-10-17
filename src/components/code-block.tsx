export function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-4 text-[13px] leading-relaxed">
      <code className="font-mono">{code}</code>
    </pre>
  );
}
