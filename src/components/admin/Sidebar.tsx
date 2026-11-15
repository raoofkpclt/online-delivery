import { NavLink } from "react-router-dom";

type Props = {
  open: boolean; // mobile drawer state
  onClose: () => void;
  onLogout: () => void;
};

const links = [
  { to: "/admin/dashboard", label: "Dashboard", icon: "M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z" },
  { to: "/admin/products", label: "Products", icon: "M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8" },
  { to: "/admin/orders", label: "Orders", icon: "M6 7h12l1 13H5L6 7ZM9 7a3 3 0 0 1 6 0" },
  { to: "/admin/users", label: "Users", icon: "M16 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 20v-1a4 4 0 0 0-3-3.9M15 4.2a3.5 3.5 0 0 1 0 6.6" },
  { to: "/admin/coupons", label: "Coupons & Offers", icon: "M3 12V4h8l10 10-8 8L3 12ZM7.5 7.5h.01" },
  { to: "/admin/cms", label: "CMS", icon: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5M9 13h6M9 17h6" },
  { to: "/admin/sales", label: "Sales Report", icon: "M4 20V10M10 20V4M16 20v-8M22 20H2" },
];

export function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export default function Sidebar({ open, onClose, onLogout }: Props) {
  return (
    <>
      {/* mobile overlay */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-[2px] transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* phone: slide-in drawer (85% of the screen at most). desktop: fixed 16rem sidebar */}
      <aside
        aria-label="Admin navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r border-emerald-100 bg-white text-slate-600 shadow-xl shadow-emerald-900/10 transition-[transform,visibility] duration-200 lg:w-64 lg:translate-x-0 lg:visible lg:shadow-none ${
          open ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        {/* brand (same height as the page header) */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-emerald-100 px-4 sm:h-16 lg:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/30">
              <Icon d="M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8" className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-semibold text-slate-900">Rahath</p>
              <p className="text-xs text-slate-500">Admin panel</p>
            </div>
          </div>

          {/* close button, phones only */}
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 lg:hidden"
          >
            <Icon d="M6 6l12 12M18 6 6 18" />
          </button>
        </div>

        {/* links: taller tap targets on phones */}
        <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-4 lg:py-5">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 lg:py-2.5 ${
                  isActive
                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon d={l.icon} className={`h-5 w-5 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
                  {l.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* logout: stays clear of the phone's home bar */}
        <div className="shrink-0 border-t border-emerald-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 active:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 lg:py-2.5"
          >
            <Icon d="M15 17l5-5-5-5M20 12H9M12 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7" className="h-5 w-5 text-slate-400" />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}