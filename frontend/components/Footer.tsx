export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-slate-500 sm:px-6">
        © {new Date().getFullYear()} ClinicFlow. All rights reserved.
      </div>
    </footer>
  );
}