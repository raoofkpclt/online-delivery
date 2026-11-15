import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../routes/AuthContext"; // ← adjust paths to where this file lives
import { getErrorMessage, logoutUser } from "../../service/authService";
import { getActiveOffers } from "../../service/offerService";
import { inr } from "./Productcard"; // ← adjust if your Productcard file has another name or path
import type { Category, Offer } from "../../utils/types";

/* ───────── settings you may want to change ───────── */
const BRAND = "Rahath";
const DEFAULT_PROMO = "🚚 Cash on delivery · Fresh groceries to your door";
const SEARCH_PARAM = "q"; // your Shop page reads /shop?q=apple
/** Pages where the mobile bottom tab bar is hidden (the page has its own checkout bar). */
const HIDE_BOTTOM_NAV_ON = ["/cart"]; // add "/checkout" here to hide it there too

/* ───────── live offer for the top bar ───────── */
function offerText(o: Offer): string {
  const v = o.discountType === "percent" ? `${o.discountValue}% off` : `${inr(o.discountValue ?? 0)} off`;
  switch (o.offerType) {
    case "product_discount":
      return `${v} on selected products`;
    case "category_discount":
      return `${v} on selected categories`;
    case "buy_x_get_y":
      return `Buy ${o.buyQty}, get ${o.getQty} free`;
    case "free_delivery":
      return o.minOrderAmount ? `Free delivery above ${inr(o.minOrderAmount)}` : "Free delivery on every order";
    default:
      return "";
  }
}

// every page renders a Navbar, so share one fetch between them (refreshed after a minute)
let offersCache: { at: number; p: Promise<Offer[]> } | null = null;
function loadOffers(): Promise<Offer[]> {
  if (!offersCache || Date.now() - offersCache.at > 60_000) {
    offersCache = { at: Date.now(), p: getActiveOffers().catch(() => [] as Offer[]) };
  }
  return offersCache.p;
}

type NavbarProps = {
  /** Number of items in the cart. Wire this to your cart state, e.g. useCart().count */
  cartCount?: number;
  /** Active categories. When given, a scrollable category strip appears under the header. */
  categories?: Category[];
  /** Text for the top announcement bar, e.g. the live free-delivery offer. Falls back to a default message. */
  promo?: string;
};

/* ───────── icons ───────── */
const ICONS = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h4.5v-5h4v5h4.5V10",
  shop: "M6 8h12l1 12H5L6 8ZM9 8a3 3 0 0 1 6 0",
  orders: "M7 3h10a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1ZM9 8h6M9 12h6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0",
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z",
  logout: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9",
  cart: "M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.76L20 8H6M9.5 20h.01M17 20h.01",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  chevron: "m6 9 6 6 6-6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  leaf: "M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19c2-5 5-8 9-10",
  tag: "M3 12V4h8l10 10-8 8L3 12ZM8 8h.01",
} as const;

function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" aria-label={`${BRAND} home`} className={`flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm">
        <Icon name="leaf" className="h-5 w-5" />
      </span>
      <span className="text-xl font-bold tracking-tight text-slate-900">{BRAND}</span>
    </Link>
  );
}

/* ───────── link data ───────── */
const publicLinks = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/shop", label: "Shop", icon: "shop", end: false },
] as const;

const accountLinks = [
  { to: "/orders", label: "My orders", icon: "orders", end: false },
  { to: "/profile", label: "My profile", icon: "user", end: false },
] as const;

const desktopLinkCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${
    isActive ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
  }`;

const drawerLinkCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium ${
    isActive ? "bg-emerald-50 text-emerald-700" : "text-slate-700 hover:bg-slate-100"
  }`;

const menuItemCls =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none";

const chipCls = (active: boolean) =>
  `shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "border-emerald-600 bg-emerald-600 text-white"
      : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
  }`;

/* ───────── bottom tab (mobile app style) ───────── */
function Tab({ to, label, icon, end }: { to: string; label: string; icon: keyof typeof ICONS; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium focus:outline-none ${
          isActive ? "text-emerald-700" : "text-slate-500"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-emerald-600" />}
          <Icon name={icon} className="h-6 w-6" />
          {label}
        </>
      )}
    </NavLink>
  );
}

/** Shared storefront header: promo bar, search, categories, account menu, and a mobile bottom tab bar. */
export default function Navbar({ cartCount = 0, categories = [], promo }: NavbarProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [freeDelivery, setFreeDelivery] = useState<Offer | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  // the live free-delivery offer shown in the top bar
  useEffect(() => {
    let alive = true;
    loadOffers().then((list) => {
      if (alive) setFreeDelivery(list.find((o) => o.offerType === "free_delivery") ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  const name = profile?.name ?? user?.displayName ?? "there";
  const email = profile?.email ?? user?.email ?? "";
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const isAdmin = !!profile?.isAdmin;
  const badge = cartCount > 99 ? "99+" : String(cartCount);

  // no bottom tab bar on pages that have their own bottom bar (the cart)
  const hideBottomNav = HIDE_BOTTOM_NAV_ON.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const onShop = pathname.startsWith("/shop");
  const params = new URLSearchParams(search);
  const activeCategory = onShop ? params.get("category") : null;
  const chips = categories.slice(0, 12);

  // close menus when the page changes
  useEffect(() => {
    setDrawerOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  // keep the search box in step with the address bar
  useEffect(() => {
    setQuery(pathname.startsWith("/shop") ? new URLSearchParams(search).get(SEARCH_PARAM) ?? "" : "");
  }, [pathname, search]);

  // close the dropdown on outside click, close both on Escape
  useEffect(() => {
    if (!accountOpen && !drawerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAccountOpen(false);
        setDrawerOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen, drawerOpen]);

  // lock page scroll while the drawer is open
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onResize = () => window.innerWidth >= 768 && setDrawerOpen(false);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("resize", onResize);
    };
  }, [drawerOpen]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      setAccountOpen(false);
      setDrawerOpen(false);
      navigate("/");
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/shop?${SEARCH_PARAM}=${encodeURIComponent(q)}` : "/shop");
  };

  const searchForm = (cls: string, id: string) => (
    <form onSubmit={submitSearch} role="search" className={cls}>
      <label htmlFor={id} className="sr-only">
        Search products
      </label>
      <div className="relative w-full">
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for vegetables, fruits, groceries…"
          className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-24 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
        >
          Search
        </button>
      </div>
    </form>
  );

  return (
    <>
      {/* promo bar */}
      <div className="bg-emerald-700 px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
        {promo ? (
          promo
        ) : freeDelivery ? (
          <>
            🚚 {offerText(freeDelivery)}
            <span className="hidden sm:inline"> · Cash on delivery available</span>
          </>
        ) : (
          DEFAULT_PROMO
        )}
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        {/* row 1: brand, search, cart, account */}
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:gap-6">
          <Logo className="shrink-0" />

          {searchForm("hidden flex-1 md:block md:max-w-xl lg:max-w-2xl", "search-desktop")}

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* cart: tablet and up (phones use the bottom bar) */}
            <NavLink
              to="/cart"
              aria-label={cartCount > 0 ? `Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}` : "Cart, empty"}
              className={({ isActive }) =>
                `relative hidden rounded-full p-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 md:block ${
                  isActive ? "bg-emerald-50 text-emerald-700" : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              <Icon name="cart" className="h-6 w-6" />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[11px] font-semibold text-white ring-2 ring-white">
                  {badge}
                </span>
              )}
            </NavLink>

            {/* account area: tablet and up */}
            <div className="hidden items-center gap-2 md:flex" ref={accountRef}>
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setAccountOpen((o) => !o)}
                    aria-haspopup="menu"
                    aria-expanded={accountOpen}
                    aria-label="Account menu"
                    className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-1 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 lg:pr-3"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-semibold text-white">
                      {initial}
                    </span>
                    <span className="hidden max-w-[110px] truncate text-sm font-medium text-slate-700 lg:inline">{name}</span>
                    <Icon name="chevron" className={`hidden h-4 w-4 text-slate-500 transition-transform lg:block ${accountOpen ? "rotate-180" : ""}`} />
                  </button>

                  {accountOpen && (
                    <div role="menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
                      <div className="bg-emerald-50 px-4 py-3">
                        <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                        {email && <p className="truncate text-xs text-slate-500">{email}</p>}
                      </div>
                      <div className="p-1">
                        {accountLinks.map((l) => (
                          <Link key={l.to} role="menuitem" to={l.to} className={menuItemCls}>
                            <Icon name={l.icon} className="h-4 w-4 text-slate-500" />
                            {l.label}
                          </Link>
                        ))}
                        {isAdmin && (
                          <Link role="menuitem" to="/admin" className={menuItemCls}>
                            <Icon name="dashboard" className="h-4 w-4 text-slate-500" />
                            Admin dashboard
                          </Link>
                        )}
                      </div>
                      <div className="border-t border-slate-100 p-1">
                        <button role="menuitem" onClick={handleLogout} className={`${menuItemCls} text-red-700 hover:bg-red-50 focus:bg-red-50`}>
                          <Icon name="logout" className="h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link to="/login" className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40">
                    Sign in
                  </Link>
                  <Link to="/register" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2">
                    Sign up
                  </Link>
                </>
              )}
            </div>

            {/* menu button: phones only */}
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
              className="rounded-full p-2.5 text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 md:hidden"
            >
              <Icon name="menu" className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* row 2 (phones): search */}
        <div className="px-4 pb-3 md:hidden">{searchForm("w-full", "search-mobile")}</div>

        {/* row 3: main links (tablet and up) + category chips */}
        <div className={`border-t border-slate-100 ${chips.length === 0 ? "hidden md:block" : ""}`}>
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
            <nav aria-label="Main" className="hidden shrink-0 items-center gap-1 md:flex">
              {publicLinks.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={desktopLinkCls}>
                  {l.label}
                </NavLink>
              ))}
              {user && (
                <NavLink to="/orders" className={desktopLinkCls}>
                  My orders
                </NavLink>
              )}
            </nav>

            {chips.length > 0 && (
              <>
                <span className="hidden h-5 w-px shrink-0 bg-slate-200 md:block" aria-hidden="true" />
                <div
                  className="-mx-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  aria-label="Categories"
                  role="navigation"
                >
                  <Link to="/shop" className={chipCls(onShop && !activeCategory)}>
                    All
                  </Link>
                  {chips.map((c) => (
                    <Link key={c.id} to={`/shop?category=${c.id}`} className={chipCls(activeCategory === String(c.id))}>
                      {c.name}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button aria-label="Close menu" onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-slate-900/50" />

          <nav id="mobile-drawer" className="absolute right-0 top-0 flex h-full w-[85%] max-w-sm flex-col bg-white shadow-xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4">
              <Logo />
              <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="rounded-full p-2 text-slate-700 hover:bg-slate-100">
                <Icon name="close" className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              {user && (
                <div className="mb-3 flex items-center gap-3 rounded-2xl bg-emerald-50 p-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-base font-semibold text-white">
                    {initial}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                    {email && <p className="truncate text-xs text-slate-500">{email}</p>}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                {publicLinks.map((l) => (
                  <NavLink key={l.to} to={l.to} end={l.end} className={drawerLinkCls}>
                    <Icon name={l.icon} />
                    {l.label}
                  </NavLink>
                ))}
                <NavLink to="/cart" className={drawerLinkCls}>
                  <Icon name="cart" />
                  <span className="flex-1">Cart</span>
                  {cartCount > 0 && (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">{badge}</span>
                  )}
                </NavLink>
                {user &&
                  accountLinks.map((l) => (
                    <NavLink key={l.to} to={l.to} className={drawerLinkCls}>
                      <Icon name={l.icon} />
                      {l.label}
                    </NavLink>
                  ))}
                {user && isAdmin && (
                  <NavLink to="/admin" className={drawerLinkCls}>
                    <Icon name="dashboard" />
                    Admin dashboard
                  </NavLink>
                )}
              </div>

              {chips.length > 0 && (
                <div className="mt-5">
                  <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Categories</p>
                  <div className="mt-2 space-y-1">
                    {chips.map((c) => (
                      <Link key={c.id} to={`/shop?category=${c.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100">
                        <Icon name="tag" className="h-4 w-4 text-emerald-600" />
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-200 p-4">
              {user ? (
                <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50">
                  <Icon name="logout" className="h-4 w-4" />
                  Sign out
                </button>
              ) : (
                <div className="flex gap-2">
                  <Link to="/login" className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Sign in
                  </Link>
                  <Link to="/register" className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-700">
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* mobile bottom tab bar (hidden on the cart page) */}
      {!hideBottomNav && (
        <nav
          aria-label="Quick links"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur md:hidden"
        >
          <div className="grid grid-cols-5 items-end">
            <Tab to="/" label="Home" icon="home" end />
            <Tab to="/shop" label="Shop" icon="shop" />

            <NavLink
              to="/cart"
              aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : "Cart"}
              className="relative flex flex-col items-center pb-2 focus:outline-none"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`-mt-6 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-white ${
                      isActive ? "bg-emerald-700" : "bg-emerald-600"
                    }`}
                  >
                    <Icon name="cart" className="h-6 w-6" />
                  </span>
                  {cartCount > 0 && (
                    <span className="absolute right-[calc(50%-1.9rem)] top-[-1.2rem] flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-slate-900 ring-2 ring-white">
                      {badge}
                    </span>
                  )}
                  <span className={`mt-0.5 text-[11px] font-medium ${isActive ? "text-emerald-700" : "text-slate-500"}`}>Cart</span>
                </>
              )}
            </NavLink>

            <Tab to="/orders" label="Orders" icon="orders" />
            <Tab to={user ? "/profile" : "/login"} label={user ? "Profile" : "Sign in"} icon="user" />
          </div>
        </nav>
      )}
    </>
  );
}