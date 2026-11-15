import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { adminLogout, watchAdmin } from "../../service/adminAuthService";
import type { UserProfile } from "../../utils/types";
import Sidebar, { Icon } from "../../components/admin/Sidebar";

const titles: Record<string, string> = {
  dashboard: "Dashboard",
  products: "Products",
  orders: "Orders",
  users: "User Management",
  coupons: "Coupons & Offers",
  cms: "CMS",
  sales: "Sales Report",
};

/**
 * Layout for every admin page (sidebar + header).
 * It also guards the pages: only signed-in users with isAdmin === true get in.
 */
export default function Home() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [admin, setAdmin] = useState<UserProfile | null | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => watchAdmin(setAdmin), []);

  // phone: close the menu after the admin picks a page
  useEffect(() => setMenuOpen(false), [pathname]);

  // phone: Esc closes the menu, and the page behind it does not scroll
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    await adminLogout();
    navigate("/admin/login", { replace: true });
  };

  if (admin === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-slate-50 px-4 text-sm text-slate-500">
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600"
          aria-hidden="true"
        />
        Checking access…
      </div>
    );
  }
  if (admin === null) return <Navigate to="/admin/login" replace />;

  const title = titles[pathname.split("/")[2] ?? ""] ?? "Admin";
  const initials = (admin.name || admin.email).slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onLogout={handleLogout}
      />

      <div className="lg:pl-64">
        {/* header: light and clean, a little shorter on phones */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-emerald-100 bg-white/90 px-3 shadow-sm shadow-emerald-900/5 backdrop-blur sm:h-16 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 lg:hidden"
            >
              <Icon d="M4 6h16M4 12h16M4 18h16" />
            </button>
            <h1 className="truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
              {title}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="max-w-48 truncate text-sm font-medium text-slate-900">{admin.name}</p>
              <p className="max-w-48 truncate text-xs text-slate-500">{admin.email}</p>
            </div>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200 sm:h-10 sm:w-10"
              title={admin.email}
            >
              {initials}
            </span>
          </div>
        </header>

        {/* page content: less padding on phones, centred and capped on very wide screens */}
        <main className="mx-auto w-full max-w-[1600px] p-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6 lg:p-8">
          <Outlet context={{ admin }} />
        </main>
      </div>
    </div>
  );
}