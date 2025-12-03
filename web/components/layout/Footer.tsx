export function Footer() {
  return (
    <footer className="border-t border-slate-200/70 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>RENTNOW — African rentals reimagined.</p>
        <div className="flex items-center gap-3">
          <a
            className="hover:text-sky-600"
            href="mailto:hello@rentnow.africa"
          >
            Contact
          </a>
          <a className="hover:text-sky-600" href="https://supabase.com" target="_blank">
            Built with Supabase
          </a>
        </div>
      </div>
    </footer>
  );
}
