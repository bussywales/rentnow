type HelpIssueCardProps = {
  issue: string;
  cause: string;
  check: string;
  fix: string;
  escalate?: string;
};

export function HelpIssueCard({ issue, cause, check, fix, escalate }: HelpIssueCardProps) {
  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="help-issue-card"
    >
      <h4 className="text-sm font-semibold text-slate-900">{issue}</h4>
      <dl className="mt-3 space-y-2 text-sm text-slate-600">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Likely cause</dt>
          <dd className="mt-1">{cause}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Check</dt>
          <dd className="mt-1">{check}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Fix</dt>
          <dd className="mt-1">{fix}</dd>
        </div>
        {escalate ? (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Escalate</dt>
            <dd className="mt-1">{escalate}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
