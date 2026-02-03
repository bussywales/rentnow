export const dynamic = "force-dynamic";

export default function AgentsPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Agents</p>
      <h1 className="text-3xl font-semibold text-slate-900">Find a verified agent</h1>
      <p className="text-sm text-slate-600">
        We’re preparing the PropatyHub agent directory. Check back soon or explore listings in the
        meantime.
      </p>
    </div>
  );
}
