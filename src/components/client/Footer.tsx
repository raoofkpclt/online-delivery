import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { Category } from "../../utils/types";

// ← edit these to your real business details
const STORE = {
  name: "Rahath",
  tagline: "Fresh groceries and vegetables, delivered to your door.",
  phone: "+91 00000 00000",
  email: "support@rahath.example",
  address: "Your street, Your town, Kerala",
  hours: "Daily, 7 am to 9 pm",
};

// ← add your real links; entries with an empty href are hidden
const SOCIAL = [
  { label: "Instagram", href: "" },
  { label: "Facebook", href: "" },
  { label: "WhatsApp", href: "" }, // e.g. https://wa.me/91XXXXXXXXXX
];

const TRUST = [
  { title: "Cash on delivery", text: "Pay when your order arrives", icon: "cash" },
  { title: "Home delivery", text: "Straight from our store to you", icon: "truck" },
  { title: "Fresh every day", text: "Vegetables and daily essentials", icon: "leaf" },
] as const;

const SHOP_LINKS = [
  { label: "All products", to: "/shop" },
  { label: "Your cart", to: "/cart" },
  { label: "My orders", to: "/orders" },
];

const ACCOUNT_LINKS = [
  { label: "My profile", to: "/profile" },
  { label: "Log in", to: "/login" },
  { label: "Create account", to: "/register" },
];

const ICONS = {
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm18 2-10 7L2 6",
  pin: "M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-14v4l3 2",
  cash: "M3 7h18v10H3zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 10v.01M18 14v.01",
  truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  leaf: "M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19c2-5 5-8 9-10",
  arrow: "M5 12h14M13 6l6 6-6 6",
} as const;

function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

const linkCls =
  "inline-block py-0.5 text-sm text-emerald-100/80 transition-colors hover:text-white focus:outline-none focus-visible:underline";

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-white">{title}</h3>
      <ul className="mt-4 space-y-2">{children}</ul>
    </div>
  );
}

/** Site-wide footer. Pass `categories` (active ones) to show category links. */
export default function Footer({ categories = [] }: { categories?: Category[] }) {
  const topCategories = categories.slice(0, 6);
  const social = SOCIAL.filter((s) => s.href);

  return (
    <footer className="mt-16">
      {/* trust cards */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <ul className="grid gap-3 sm:grid-cols-3">
          {TRUST.map((t) => (
            <li key={t.title} className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                <Icon name={t.icon} className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                <p className="text-sm text-slate-600">{t.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* dark green body */}
      <div className="mt-10 bg-emerald-950 text-emerald-50">
        <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
          {/* call to action */}
          <div className="relative -mt-20 overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-8 shadow-xl sm:px-10 sm:py-10">
            <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" aria-hidden="true" />
            <div className="absolute -bottom-16 right-24 hidden h-40 w-40 rounded-full bg-white/10 sm:block" aria-hidden="true" />
            <div className="relative flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-2xl font-bold text-white sm:text-3xl">Stay fresh, shop easy</h2>
                <p className="mt-1.5 max-w-md text-sm text-emerald-50 sm:text-base">
                  Fresh vegetables and daily essentials, delivered to your door. Pay when it arrives.
                </p>
              </div>
              <Link
                to="/shop"
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                Start shopping
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* columns */}
          <div className="grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <Link to="/" className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white">
                  <Icon name="leaf" className="h-5 w-5" />
                </span>
                <span className="text-2xl font-bold tracking-tight text-white">{STORE.name}</span>
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-emerald-100/80">{STORE.tagline}</p>

              {social.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {social.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-emerald-700 px-4 py-1.5 text-xs font-medium text-emerald-50 transition hover:border-emerald-400 hover:bg-emerald-900"
                    >
                      {s.label}
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-5">
              <Column title="Shop">
                {SHOP_LINKS.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className={linkCls}>{l.label}</Link>
                  </li>
                ))}
              </Column>

              {topCategories.length > 0 && (
                <Column title="Categories">
                  {topCategories.map((c) => (
                    <li key={c.id}>
                      <Link to={`/shop?category=${c.id}`} className={linkCls}>{c.name}</Link>
                    </li>
                  ))}
                </Column>
              )}

              <Column title="Account">
                {ACCOUNT_LINKS.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className={linkCls}>{l.label}</Link>
                  </li>
                ))}
              </Column>
            </div>

            <div className="lg:col-span-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-white">Contact us</h3>
              <ul className="mt-4 space-y-3 text-sm text-emerald-100/80">
                <li className="flex gap-3">
                  <Icon name="phone" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <a href={`tel:${STORE.phone.replace(/\s/g, "")}`} className="hover:text-white">{STORE.phone}</a>
                </li>
                <li className="flex gap-3">
                  <Icon name="mail" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <a href={`mailto:${STORE.email}`} className="break-all hover:text-white">{STORE.email}</a>
                </li>
                <li className="flex gap-3">
                  <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{STORE.address}</span>
                </li>
                <li className="flex gap-3">
                  <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{STORE.hours}</span>
                </li>
              </ul>

              <a
                href={`tel:${STORE.phone.replace(/\s/g, "")}`}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 md:hidden"
              >
                <Icon name="phone" className="h-4 w-4" />
                Call us now
              </a>
            </div>
          </div>
        </div>

        {/* bottom bar (extra bottom space on phones so the tab bar never covers it) */}
        <div className="border-t border-emerald-900">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 pb-24 text-xs text-emerald-200/70 sm:px-6 md:pb-5 sm:flex-row">
            <span>© {new Date().getFullYear()} {STORE.name}. All rights reserved.</span>
            <span>Cash on delivery available on all orders</span>
          </div>
        </div>
      </div>
    </footer>
  );
}