export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Offline</p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-900">
        You&apos;re offline
      </h1>
      <p className="mt-4 text-sm text-slate-600">
        The connection dropped, so this page is unavailable right now. Check your
        network and try again.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Core dashboards and messages require an active connection.
      </p>
    </div>
  );
}
