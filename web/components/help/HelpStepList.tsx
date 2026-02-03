type HelpStepListProps = {
  steps: string[];
};

export function HelpStepList({ steps }: HelpStepListProps) {
  return (
    <ol className="space-y-3" data-testid="help-step-list">
      {steps.map((step, index) => (
        <li key={step} className="flex gap-3">
          <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {index + 1}
          </span>
          <p className="text-sm text-slate-700">{step}</p>
        </li>
      ))}
    </ol>
  );
}
