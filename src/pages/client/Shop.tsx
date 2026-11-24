import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../../components/client/Navbar";
import Footer from "../../components/client/Footer";
import ProductCard, { inr } from "../../components/client/Productcard";
import { useCart } from "../../routes/client/ Cartcontext"; // ← adjust: your cart hook
import { getErrorMessage } from "../../service/authService";
import { getBanners, type Banner } from "../../service/ cmsservice";
import { createCrud } from "../../service/firestoreCrud";
import { getActiveOffers } from "../../service/offerService";
import { getProducts } from "../../service/productService";
import { getDeal, type Deal } from "../../utils/pricing";
import type { Category, Offer, Product } from "../../utils/types";

const categoryCrud = createCrud<Category>("categories");

const PAGE_SIZE = 12;

/** hides the scrollbar on a scrolling row */
const NO_BAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// function offerText(o: Offer) {
//   const v = o.discountType === "percent" ? `${o.discountValue}% off` : `${inr(o.discountValue ?? 0)} off`;
//   switch (o.offerType) {
//     case "product_discount":
//       return `${v} on selected products`;
//     case "category_discount":
//       return `${v} on selected categories`;
//     case "buy_x_get_y":
//       return `Buy ${o.buyQty}, get ${o.getQty} free`;
//     case "free_delivery":
//       return o.minOrderAmount ? `Free delivery above ${inr(o.minOrderAmount)}` : "Free delivery on every order";
//   }
// }

type SortKey = "newest" | "price_asc" | "price_desc" | "discount" | "name";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "discount", label: "Biggest discount" },
  { value: "name", label: "Name: A to Z" },
];

// ← adjust if your Product uses a different field to point at its category
const catOf = (p: Product) => (p as Product & { categoryId?: string }).categoryId ?? "";

type Priced = { product: Product; deal: Deal };

/* ---------- small pieces ---------- */

/** The admin's shop banner (set in the CMS). Goes to its link when tapped. Hidden if the image can't load. */
function ShopBanner({ banner }: { banner: Banner }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  const cls =
    "mt-5 block aspect-[16/3] overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-200";
  const img = (
    <img
      src={banner.url}
      alt={banner.alt}
      onError={() => {
        console.error("Shop banner failed to load. Check the S3 bucket allows public reads:", banner.url);
        setFailed(true);
      }}
      className="h-full w-full object-cover"
    />
  );

  if (!banner.link) return <div className={cls}>{img}</div>;
  return banner.link.startsWith("/") ? (
    <Link to={banner.link} className={cls}>
      {img}
    </Link>
  ) : (
    <a href={banner.link} target="_blank" rel="noopener noreferrer" className={cls}>
      {img}
    </a>
  );
}

function Check({ checked, onChange, label, count }: { checked: boolean; onChange: () => void; label: string; count?: number }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
      <span className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600/40"
        />
        {label}
      </span>
      {count !== undefined && <span className="text-xs text-slate-400">{count}</span>}
    </label>
  );
}

type PanelProps = {
  categories: Category[];
  counts: Record<string, number>;
  total: number;
  category: string;
  onCategory: (id: string) => void;
  minText: string;
  maxText: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  priceCeiling: number;
  inStock: boolean;
  onStock: () => void;
  offersOnly: boolean;
  onOffers: () => void;
};

function FilterPanel(p: PanelProps) {
  const catBtn = (active: boolean) =>
    `flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
      active ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-700 hover:bg-slate-50"
    }`;

  const numCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30";

  return (
    <div className="space-y-7">
      <section aria-labelledby="f-cat">
        <h3 id="f-cat" className="mb-2 text-sm font-semibold text-slate-900">Category</h3>
        <div className="space-y-0.5">
          <button onClick={() => p.onCategory("")} className={catBtn(!p.category)}>
            <span>All products</span>
            <span className="text-xs text-slate-400">{p.total}</span>
          </button>
          {p.categories.map((c) => (
            <button key={c.id} onClick={() => p.onCategory(c.id)} className={catBtn(p.category === c.id)}>
              <span>{c.name}</span>
              <span className="text-xs text-slate-400">{p.counts[c.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="f-price">
        <h3 id="f-price" className="mb-2 text-sm font-semibold text-slate-900">Price (₹)</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Min"
            aria-label="Minimum price"
            value={p.minText}
            onChange={(e) => p.onMin(e.target.value)}
            className={numCls}
          />
          <span className="text-slate-400">to</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={p.priceCeiling ? String(p.priceCeiling) : "Max"}
            aria-label="Maximum price"
            value={p.maxText}
            onChange={(e) => p.onMax(e.target.value)}
            className={numCls}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[100, 250, 500].map((n) => (
            <button
              key={n}
              onClick={() => {
                p.onMin("");
                p.onMax(String(n));
              }}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:border-emerald-600 hover:text-emerald-700"
            >
              Under {inr(n)}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="f-avail">
        <h3 id="f-avail" className="mb-2 text-sm font-semibold text-slate-900">Availability</h3>
        <Check checked={p.inStock} onChange={p.onStock} label="In stock only" />
        <Check checked={p.offersOnly} onChange={p.onOffers} label="On offer" />
      </section>
    </div>
  );
}

/* ---------- page ---------- */

export default function Shop() {
  const { count, addItem } = useCart();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  /* Back button (mobile only).
     Goes to the previous page. If the shop was opened directly (no history inside the app),
     it goes to the home page instead so the button never leaves the site. */
  const goBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/");
  };

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [shopBanner, setShopBanner] = useState<Banner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [addedId, setAddedId] = useState<string | null>(null);
  const addTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [drawer, setDrawer] = useState(false);

  /* filter state lives in the URL so links, refresh and back button all work */
  const category = params.get("category") ?? "";
  const sort = (params.get("sort") as SortKey) || "newest";
  const inStock = params.get("stock") === "1";
  const offersOnly = params.get("offers") === "1";
  const qParam = params.get("q") ?? "";
  const minParam = params.get("min") ?? "";
  const maxParam = params.get("max") ?? "";

  // typed fields are local first, then pushed to the URL after a short pause
  const [q, setQ] = useState(qParam);
  const [minText, setMinText] = useState(minParam);
  const [maxText, setMaxText] = useState(maxParam);

  function patch(changes: Record<string, string>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      },
      { replace: true }
    );
  }

  useEffect(() => {
    const t = setTimeout(() => patch({ q: q.trim(), min: minText, max: maxText }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, minText, maxText]);

  /* data */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([
      getProducts({ onlyActive: true }),
      categoryCrud.list(),
      getActiveOffers(),
      // the banner is optional: if it fails to load the shop still works
      getBanners()
        .then((b) => b.shopBanner)
        .catch((e) => {
          console.error("Could not load banners:", e);
          return null;
        }),
    ])
      .then(([p, c, o, b]) => {
        if (!alive) return;
        setProducts(p);
        setCategories(c.filter((x) => x.isActive));
        setOffers(o);
        setShopBanner(b);
      })
      .catch((e) => alive && setError(getErrorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  useEffect(() => () => clearTimeout(addTimer.current), []);

  /* derived data */
  const priced: Priced[] = useMemo(
    () => products.map((product) => ({ product, deal: getDeal(product, offers) })),
    [products, offers]
  );

  // const freeDelivery = useMemo(() => offers.find((o) => o.offerType === "free_delivery"), [offers]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const { product } of priced) {
      const id = catOf(product);
      if (id) m[id] = (m[id] ?? 0) + 1;
    }
    return m;
  }, [priced]);

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const priceCeiling = useMemo(
    () => Math.ceil(Math.max(0, ...priced.map((x) => x.deal.price))),
    [priced]
  );

  const results = useMemo(() => {
    const min = minParam === "" ? 0 : Number(minParam);
    const max = maxParam === "" ? Infinity : Number(maxParam);
    const tokens = qParam.toLowerCase().split(/\s+/).filter(Boolean);

    const list = priced.filter(({ product, deal }) => {
      if (category && catOf(product) !== category) return false;
      if (inStock && product.stock <= 0) return false;
      if (offersOnly && deal.percentOff <= 0) return false;
      if (deal.price < min || deal.price > max) return false;
      if (tokens.length) {
        const hay = `${product.name} ${product.unit ?? ""} ${catName.get(catOf(product)) ?? ""}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) return false;
      }
      return true;
    });

    const stockRank = (x: Priced) => (x.product.stock <= 0 ? 1 : 0); // in-stock always first
    const created = (x: Priced) => x.product.createdAt?.toMillis() ?? 0;

    list.sort((a, b) => {
      const s = stockRank(a) - stockRank(b);
      if (s) return s;
      switch (sort) {
        case "price_asc":
          return a.deal.price - b.deal.price;
        case "price_desc":
          return b.deal.price - a.deal.price;
        case "discount":
          return b.deal.percentOff - a.deal.percentOff || created(b) - created(a);
        case "name":
          return a.product.name.localeCompare(b.product.name);
        default:
          return created(b) - created(a);
      }
    });
    return list;
  }, [priced, category, inStock, offersOnly, minParam, maxParam, qParam, sort, catName]);

  // go back to the first page whenever the filters change
  const filterKey = params.toString();
  useEffect(() => setShown(PAGE_SIZE), [filterKey]);

  const visible = results.slice(0, shown);

  const chips: { label: string; clear: () => void }[] = [];
  if (qParam) chips.push({ label: `“${qParam}”`, clear: () => { setQ(""); patch({ q: "" }); } });
  if (category) chips.push({ label: catName.get(category) ?? "Category", clear: () => patch({ category: "" }) });
  if (minParam || maxParam)
    chips.push({
      label: `${minParam ? inr(Number(minParam)) : inr(0)} – ${maxParam ? inr(Number(maxParam)) : "any"}`,
      clear: () => { setMinText(""); setMaxText(""); patch({ min: "", max: "" }); },
    });
  if (inStock) chips.push({ label: "In stock", clear: () => patch({ stock: "" }) });
  if (offersOnly) chips.push({ label: "On offer", clear: () => patch({ offers: "" }) });

  function clearAll() {
    setQ("");
    setMinText("");
    setMaxText("");
    setParams({}, { replace: true });
  }

  function handleAdd(product: Product, deal: Deal) {
    addItem({ ...product, price: deal.price }, 1); // add at the offer price
    setAddedId(product.id);
    clearTimeout(addTimer.current);
    addTimer.current = setTimeout(() => setAddedId(null), 1500);
  }

  // mobile drawer: Esc closes, page behind does not scroll
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawer]);

  const panel = (
    <FilterPanel
      categories={categories}
      counts={counts}
      total={products.length}
      category={category}
      onCategory={(id) => patch({ category: id })}
      minText={minText}
      maxText={maxText}
      onMin={setMinText}
      onMax={setMaxText}
      priceCeiling={priceCeiling}
      inStock={inStock}
      onStock={() => patch({ stock: inStock ? "" : "1" })}
      offersOnly={offersOnly}
      onOffers={() => patch({ offers: offersOnly ? "" : "1" })}
    />
  );

  const grid = "grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4";

  return (
    <div className={`min-h-screen bg-slate-50 ${count > 0 ? "pb-20 sm:pb-0" : ""}`}>
      {/* announcement bar: the live free-delivery offer, or the cash on delivery promise */}
      {/* <div className="bg-emerald-700 px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
        {freeDelivery ? `🚚 ${offerText(freeDelivery)}` : "🚚 Cash on delivery · Fresh groceries to your door"}
      </div> */}

      <Navbar cartCount={count} />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* breadcrumb: hidden on mobile, visible from the sm breakpoint up */}
        <nav aria-label="Breadcrumb" className="hidden text-sm text-slate-500 sm:block">
          <Link to="/" className="hover:text-slate-800">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-800">Shop</span>
        </nav>

        {/* title row: small back button on phones only (the breadcrumb covers larger screens) */}
        <div className="flex items-center gap-2 sm:mt-2">
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 sm:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {category ? catName.get(category) ?? "Products" : "All products"}
          </h1>
        </div>

        {/* banner set in the CMS */}
        {shopBanner && <ShopBanner banner={shopBanner} />}

        {/* search + sort bar */}
        <div className="sticky top-0 z-20 -mx-4 mt-5 border-y border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:bg-white sm:px-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative min-w-0 flex-1 basis-full sm:basis-64">
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search rice, onion, milk…"
                aria-label="Search products"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
              />
              {q && (
                <button
                  onClick={() => { setQ(""); patch({ q: "" }); }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="m5 5 10 10M15 5 5 15" />
                  </svg>
                </button>
              )}
            </div>

            <button
              onClick={() => setDrawer(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:hidden"
            >
              Filters
              {chips.length > 0 && (
                <span className="rounded-full bg-emerald-600 px-1.5 text-xs font-semibold text-white">{chips.length}</span>
              )}
            </button>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span className="sr-only sm:not-sr-only">Sort</span>
              <select
                value={sort}
                onChange={(e) => patch({ sort: e.target.value === "newest" ? "" : e.target.value })}
                className="rounded-xl border border-slate-300 bg-white py-2.5 pl-3 pr-8 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* category pills for small screens */}
        {categories.length > 0 && (
          <div className={`-mx-4 mt-4 flex snap-x gap-2 overflow-x-auto scroll-smooth px-4 pb-1 lg:hidden ${NO_BAR}`}>
            {[{ id: "", name: "All" }, ...categories].map((c) => (
              <button
                key={c.id || "all"}
                onClick={() => patch({ category: c.id })}
                className={`shrink-0 snap-start rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${
                  category === c.id ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-slate-700 ring-slate-300"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 grid gap-8 lg:grid-cols-[16rem_1fr]">
          {/* desktop filters */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Filters</h2>
                {chips.length > 0 && (
                  <button onClick={clearAll} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
                    Clear all
                  </button>
                )}
              </div>
              {panel}
            </div>
          </aside>

          {/* results */}
          <section aria-live="polite">
            {error && (
              <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
                <span>{error}</span>
                <button onClick={() => setReloadKey((k) => k + 1)} className="font-semibold underline">Try again</button>
              </div>
            )}

            {!loading && !error && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <p className="mr-1 text-sm text-slate-600">
                  {results.length} {results.length === 1 ? "product" : "products"}
                </p>
                {chips.map((c) => (
                  <button
                    key={c.label}
                    onClick={c.clear}
                    className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                  >
                    {c.label}
                    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <path d="m5 5 10 10M15 5 5 15" />
                    </svg>
                    <span className="sr-only">Remove filter</span>
                  </button>
                ))}
                {chips.length > 1 && (
                  <button onClick={clearAll} className="text-xs font-medium text-slate-500 underline hover:text-slate-800 lg:hidden">
                    Clear all
                  </button>
                )}
              </div>
            )}

            {loading ? (
              <div className={grid}>
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="h-72 animate-pulse rounded-2xl bg-slate-200/70" />
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="rounded-2xl bg-white px-6 py-16 text-center ring-1 ring-slate-200">
                <p className="text-base font-semibold text-slate-900">
                  {products.length === 0 ? "Products are on their way" : "No products match your search"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {products.length === 0 ? "Please check back soon." : "Try a different word, or remove some filters."}
                </p>
                {chips.length > 0 && (
                  <button onClick={clearAll} className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className={grid}>
                  {visible.map(({ product, deal }) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      deal={deal}
                      added={addedId === product.id}
                      onAdd={() => handleAdd(product, deal)}
                    />
                  ))}
                </div>

                <div className="mt-8 text-center">
                  <p className="text-sm text-slate-500">
                    Showing {visible.length} of {results.length}
                  </p>
                  {visible.length < results.length && (
                    <button
                      onClick={() => setShown((n) => n + PAGE_SIZE)}
                      className="mt-3 rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
                    >
                      Show more products
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      <Footer categories={categories} />

      {/* phone only: a cart shortcut once something is added */}
      {count > 0 && !drawer && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-3 sm:hidden">
          <Link
            to="/cart"
            className="flex items-center justify-between rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-emerald-900/25"
          >
            <span>
              {count} {count === 1 ? "item" : "items"} in your cart
            </span>
            <span>View cart →</span>
          </Link>
        </div>
      )}

      {/* mobile filter drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button className="absolute inset-0 bg-slate-900/50" aria-label="Close filters" onClick={() => setDrawer(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Filters</h2>
              <button onClick={() => setDrawer(false)} className="text-sm font-medium text-slate-500 hover:text-slate-800">
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">{panel}</div>
            <div className="flex gap-3 border-t border-slate-200 px-5 py-4">
              <button
                onClick={clearAll}
                disabled={chips.length === 0}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-40"
              >
                Clear all
              </button>
              <button
                onClick={() => setDrawer(false)}
                className="flex-[2] rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Show {results.length} {results.length === 1 ? "product" : "products"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}