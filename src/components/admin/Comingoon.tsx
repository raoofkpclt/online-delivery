import type { ReactNode } from "react";

type Props = {
  title: string;
  /** Optional line about what the page will do. */
  description?: string;
  /** Optional icon; a construction-style icon is used if omitted. */
  icon?: ReactNode;
};

/** Placeholder for admin pages that are not built yet. */
export default function ComingSoon({ title, description, icon }: Props) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h2>
      </div>

      <div className="flex min-h-[55vh] flex-col items-center justify-center rounded-2xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-slate-200">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          {icon ?? (
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z" />
            </svg>
          )}
        </span>

        <span className="mt-5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Coming soon
        </span>

        <h3 className="mt-3 text-lg font-semibold text-slate-900">
          {title} is on its way
        </h3>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">
          {description ?? "We're still building this page. Check back soon."}
        </p>

        <button
          type="button"
          onClick={() => window.history.back()}
          className="mt-6 w-full max-w-xs rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 sm:w-auto"
        >
          Go back
        </button>
      </div>
    </div>
  );
}
