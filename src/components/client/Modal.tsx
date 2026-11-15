import { useEffect, type ReactNode } from "react";

type Props = { title: string; onClose: () => void; busy?: boolean; children: ReactNode };

/** Bottom sheet on phones, centred dialog on larger screens. Closes on Escape or a click outside. */
export default function Modal({ title, onClose, busy, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 sm:items-start sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-2xl rounded-t-2xl bg-white p-5 shadow-xl sm:my-8 sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} disabled={busy} aria-label="Close" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}