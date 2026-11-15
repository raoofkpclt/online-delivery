import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import Navbar from "../../components/client/Navbar";
import { useCart } from "../../routes/client/ Cartcontext"; // ← adjust: your cart hook
import { getErrorMessage } from "../../service/authService";
import { getBanners, type Banner, type Banners } from "../../service/ cmsservice";
import { createCrud } from "../../service/firestoreCrud";
import { getActiveOffers } from "../../service/offerService";
import { getProducts } from "../../service/productService";
import { getDeal, type Deal } from "../../utils/pricing";
import type { Category, Offer, Product } from "../../utils/types";
import Footer from "../../components/client/Footer";

const categoryCrud = createCrud<Category>("categories");

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const TRUST = ["Cash on delivery", "Delivered to your door", "Fresh every day"];

const LOW_STOCK = 5;
const PER_BLOCK = 8;
const SLIDE_MS = 5000;

/** Height of your fixed bottom navbar in px (h-16 = 64) plus a small gap. Raise it to lift the bar higher, lower it to bring it down.
 *  The "View cart" bar sits right above it, so both stay visible while scrolling. */
const BOTTOM_NAV_H = 72;

/** hides the scrollbar on a scrolling row */
const NO_BAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

type Priced = { product: Product; deal: Deal };
type Slide = { key: string; url: string; alt: string; to: string };

/* ───────── pieces ───────── */

const Check = () => (
  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white" aria-hidden="true">
    <svg viewBox="0 0 20 20" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 10 3.5 3.5L15 7" />
    </svg>
  </span>
);

function SectionHead({
  title,
  note,
  to,
  label = "View all",
  children,
}: {
  title: string;
  note?: string;
  to?: string;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h2>
        {note && <p className="mt-0.5 text-sm text-slate-500">{note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {children}
        {to && (
          <Link to={to} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
            {label} →
          </Link>
        )}
      </div>
    </div>
  );
}

/** Hero for 1600 × 600 images (8:3). Changes every 5s, pauses on hover/touch,
 *  arrows (desktop hover), dots, and swipe on phones. */
function HeroSlider({ slides }: { slides: Slide[] }) {
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const list = useMemo(() => slides.filter((s) => !failed.has(s.key)), [slides, failed]);
  const n = list.length;

  // keep the index valid when slides change or an image fails
  useEffect(() => {
    if (index >= n) setIndex(0);
  }, [n, index]);

  // auto-advance; the timer restarts after every change
  useEffect(() => {
    if (n < 2 || paused) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % n), SLIDE_MS);
    return () => clearTimeout(id);
  }, [index, n, paused]);

  if (n === 0) return null;

  const go = (i: number) => setIndex(((i % n) + n) % n);

  return (
    <div
      className="group relative aspect-[8/3] w-full overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-200"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        setPaused(true);
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current !== null) {
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        }
        touchX.current = null;
        setPaused(false);
      }}
      aria-roledescription="carousel"
      aria-label="Featured offers"
    >
      {list.map((s, i) => {
        const active = i === index;
        const cls = `absolute inset-0 transition-opacity duration-700 ${active ? "opacity-100" : "pointer-events-none opacity-0"}`;
        const img = (
          <img
            src={s.url}
            alt={s.alt}
            loading={i === 0 ? "eager" : "lazy"}
            onError={() => {
              console.error("Banner image failed to load. Check the S3 bucket allows public reads:", s.url);
              setFailed((f) => new Set(f).add(s.key));
            }}
            className="h-full w-full object-cover"
          />
        );
        return s.to.startsWith("/") ? (
          <Link key={s.key} to={s.to} className={cls} aria-hidden={!active} tabIndex={active ? 0 : -1}>
            {img}
          </Link>
        ) : (
          <a key={s.key} href={s.to} target="_blank" rel="noopener noreferrer" className={cls} aria-hidden={!active} tabIndex={active ? 0 : -1}>
            {img}
          </a>
        );
      })}

      {n > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous banner"
            onClick={() => go(index - 1)}
            className="absolute left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-800 opacity-0 shadow transition hover:bg-white group-hover:opacity-100 sm:flex"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next banner"
            onClick={() => go(index + 1)}
            className="absolute right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-800 opacity-0 shadow transition hover:bg-white group-hover:opacity-100 sm:flex"
          >
            ›
          </button>

          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5 sm:bottom-3">
            {list.map((s, i) => (
              <button
                key={s.key}
                type="button"
                aria-label={`Show banner ${i + 1}`}
                aria-current={i === index}
                onClick={() => go(i)}
                className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-2 bg-white/60 hover:bg-white/80"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** A CMS banner / poster. Shows the whole image at its exact ratio (no cropping).
 *  Always clickable: goes to the admin's link, or the shop if none was set. Hidden if the image fails. */
function Promo({ banner, aspect, eager = false, className = "" }: { banner: Banner; aspect: string; eager?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  const to = banner.link || "/shop";
  const cls = `group relative block overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-200 ${aspect} ${className}`;
  const img = (
    <img
      src={banner.url}
      alt={banner.alt}
      loading={eager ? "eager" : "lazy"}
      onError={() => {
        console.error("Banner image failed to load. Check the S3 bucket allows public reads:", banner.url);
        setFailed(true);
      }}
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
    />
  );

  return to.startsWith("/") ? (
    <Link to={to} className={cls}>
      {img}
    </Link>
  ) : (
    <a href={to} target="_blank" rel="noopener noreferrer" className={cls}>
      {img}
    </a>
  );
}

function ProductCard({
  product,
  deal,
  added,
  onAdd,
}: {
  product: Product;
  deal: Deal;
  added: boolean;
  onAdd: () => void;
}) {
  const out = product.stock <= 0;
  const low = !out && product.stock <= LOW_STOCK;
  const saved = deal.original - deal.price;
  const href = `/product/${product.id}`; // must match your route in App.tsx

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:shadow-md">
      <Link
        to={href}
        aria-label={`View ${product.name}`}
        className="relative block aspect-square bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
      >
        {product.images?.[0] && (
          <img src={product.images[0]} alt={product.name} loading="lazy" className={`h-full w-full object-cover ${out ? "opacity-50" : ""}`} />
        )}
        {deal.percentOff > 0 && !out && (
          <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
            {deal.percentOff}% off
          </span>
        )}
        {out && (
          <span className="absolute left-2 top-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-white">
            Out of stock
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <Link to={href} className="hover:text-emerald-700 focus:outline-none focus-visible:underline">
          <h3 className="line-clamp-2 text-sm font-medium text-slate-900">{product.name}</h3>
        </Link>
        {product.unit && <p className="text-xs text-slate-500">per {product.unit}</p>}
        {deal.bundle && <p className="mt-1 text-xs font-medium text-amber-700">{deal.bundle}</p>}

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-base font-semibold text-slate-900">{inr(deal.price)}</span>
          {deal.percentOff > 0 && <span className="text-xs text-slate-400 line-through">{inr(deal.original)}</span>}
        </div>
        {saved > 0 && !out && <p className="text-xs font-medium text-emerald-700">You save {inr(saved)}</p>}
        {low && <p className="mt-1 text-xs font-medium text-red-600">Only {product.stock} left</p>}

        <button
          onClick={onAdd}
          disabled={out}
          className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600/40 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
            added ? "bg-emerald-50 text-emerald-700" : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          {out ? "Unavailable" : added ? "✓ Added to cart" : "Add to cart"}
        </button>
      </div>
    </article>
  );
}

/** One block of up to 8 products: 2 per row on phones, 4 per row from tablet up. */
function ProductBlock({
  title,
  note,
  items,
  loading,
  addedId,
  onAdd,
}: {
  title: string;
  note?: string;
  items: Priced[];
  loading: boolean;
  addedId: string | null;
  onAdd: (p: Product, d: Deal) => void;
}) {
  const grid = "grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4";
  return (
    <section>
      <SectionHead title={title} note={note} to="/shop" />
      {loading ? (
        <div className={grid}>
          {Array.from({ length: PER_BLOCK }, (_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl bg-white px-5 py-12 text-center text-slate-500 ring-1 ring-slate-200">
          Products are on their way. Please check back soon.
        </p>
      ) : (
        <div className={grid}>
          {items.map(({ product, deal }) => (
            <ProductCard key={product.id} product={product} deal={deal} added={addedId === product.id} onAdd={() => onAdd(product, deal)} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Categories on ONE line. Swipe on phones, scroll on bigger screens. */
function CategoryRow({ categories, loading }: { categories: Category[]; loading: boolean }) {
  return (
    <section>
      <SectionHead title="Shop by category" to="/shop" label="All products" />

      <div className={`-mx-4 flex snap-x gap-3 overflow-x-auto scroll-smooth px-4 pb-2 sm:mx-0 sm:gap-4 sm:px-0 ${NO_BAR}`}>
        {loading
          ? Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-32 w-24 shrink-0 animate-pulse rounded-2xl bg-slate-200/70 sm:w-28" />
            ))
          : categories.map((c) => (
              <Link
                key={c.id}
                to={`/shop?category=${c.id}`}
                className="group flex w-24 shrink-0 snap-start flex-col items-center gap-2 rounded-2xl bg-white px-2 py-3 text-center shadow-sm ring-1 ring-slate-200 transition hover:ring-emerald-300 sm:w-28"
              >
                {c.imageUrl ? (
                  <img src={c.imageUrl} alt="" loading="lazy" className="h-16 w-16 rounded-full object-cover sm:h-[72px] sm:w-[72px]" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-xl font-semibold text-emerald-700 sm:h-[72px] sm:w-[72px]">
                    {c.name.charAt(0)}
                  </span>
                )}
                <span className="line-clamp-2 text-xs font-medium text-slate-800 group-hover:text-emerald-700 sm:text-sm">{c.name}</span>
              </Link>
            ))}
      </div>
    </section>
  );
}

/* ───────── page ───────── */

/** Public storefront. Anyone can browse; login is only needed at checkout. */
export default function Home() {
  const { count, addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [cms, setCms] = useState<Banners | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addedId, setAddedId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    Promise.all([
      getProducts({ onlyActive: true }),
      categoryCrud.list(),
      getActiveOffers(),
      // banners are optional: if they fail to load the page still works
      getBanners().catch((e) => {
        console.error("Could not load banners:", e);
        return null;
      }),
    ])
      .then(([p, c, o, b]) => {
        if (!alive) return;
        setProducts(p);
        setCategories(c.filter((x) => x.isActive));
        setOffers(o);
        setCms(b);
      })
      .catch((e) => alive && setError(getErrorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      clearTimeout(timer.current);
    };
  }, []);

  const priced: Priced[] = useMemo(() => products.map((p) => ({ product: p, deal: getDeal(p, offers) })), [products, offers]);

  // hero slides: CMS main banner first, then every offer with a banner marked "Show on the home page"
  const slides: Slide[] = useMemo(() => {
    const list: Slide[] = [];
    if (cms?.mainBanner) {
      list.push({
        key: "main",
        url: cms.mainBanner.url,
        alt: cms.mainBanner.alt || "Featured",
        to: cms.mainBanner.link || "/shop",
      });
    }
    offers
      .filter((o) => o.showOnHome && o.bannerUrl)
      .forEach((o) => list.push({ key: `offer-${o.id}`, url: o.bannerUrl!, alt: o.title, to: "/shop" }));
    return list;
  }, [cms, offers]);

  // in stock first, then items on offer, then newest. Split into two blocks of 8.
  const ranked = useMemo(() => {
    const created = (x: Priced) => x.product.createdAt?.toMillis() ?? 0;
    return [...priced].sort((a, b) => {
      const aOut = a.product.stock <= 0 ? 1 : 0;
      const bOut = b.product.stock <= 0 ? 1 : 0;
      if (aOut !== bOut) return aOut - bOut;
      const aDeal = a.deal.percentOff > 0 ? 1 : 0;
      const bDeal = b.deal.percentOff > 0 ? 1 : 0;
      if (aDeal !== bDeal) return bDeal - aDeal;
      return created(b) - created(a);
    });
  }, [priced]);

  const firstBlock = ranked.slice(0, PER_BLOCK);
  const secondBlock = ranked.slice(PER_BLOCK, PER_BLOCK * 2);

  const posters = [cms?.poster1, cms?.poster2, cms?.poster3].filter((p): p is Banner => !!p);

  function handleAdd(product: Product, deal: Deal) {
    // add at the offer price so cart and checkout match what the customer saw
    addItem({ ...product, price: deal.price }, 1);
    setAddedId(product.id);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAddedId(null), 1500);
  }

  const page = (
    <div className={`min-h-screen bg-slate-50 ${count > 0 ? "pb-36 sm:pb-0" : ""}`}>
      <Navbar cartCount={count} />

      <main>
        <div className="mx-auto max-w-6xl space-y-10 px-4 py-5 sm:space-y-12 sm:px-6 sm:py-8">
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
              {error}
            </p>
          )}

          {/* 1. hero slider: main banner + offer banners (1600 × 600), or a text hero if there are none */}
          <section aria-label="Featured">
            {loading ? (
              <div className="aspect-[8/3] animate-pulse rounded-2xl bg-slate-200/70" />
            ) : slides.length > 0 ? (
              <HeroSlider slides={slides} />
            ) : (
              <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 px-6 py-10 text-white sm:px-12 sm:py-16">
                <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
                  Fresh groceries and vegetables, delivered to your door
                </h1>
                <p className="mt-3 max-w-md text-emerald-50">Browse freely. You only need an account when you check out.</p>
                <Link
                  to="/shop"
                  className="mt-6 inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-emerald-800 shadow-lg hover:bg-emerald-50"
                >
                  Shop now
                </Link>
              </div>
            )}

            <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs font-medium text-slate-700 sm:text-sm">
              {TRUST.map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check />
                  {t}
                </li>
              ))}
            </ul>
          </section>

          {/* 2. categories, one line, scrolls sideways */}
          {(loading || categories.length > 0) && <CategoryRow categories={categories} loading={loading} />}

          {/* 3. row of three posters */}
          {posters.length > 0 && (
            <section aria-label="Posters">
              <div className={`-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 ${NO_BAR}`}>
                {posters.map((p) => (
                  <Promo key={p.url} banner={p} aspect="aspect-[3/2]" className="w-[78%] shrink-0 snap-start sm:w-auto" />
                ))}
              </div>
            </section>
          )}

          {/* 4. first 8 products */}
          <ProductBlock
            title="Today’s picks"
            note="Best prices and fresh arrivals"
            items={firstBlock}
            loading={loading}
            addedId={addedId}
            onAdd={handleAdd}
          />

          {/* 5. small banner (1600 × 300) */}
          {cms?.smallBanner && <Promo banner={cms.smallBanner} aspect="aspect-[16/3]" />}

          {/* 6. next 8 products */}
          {(loading || secondBlock.length > 0) && (
            <ProductBlock
              title="More fresh products"
              items={secondBlock}
              loading={loading}
              addedId={addedId}
              onAdd={handleAdd}
            />
          )}

          {/* 7. last banner */}
          {cms?.bottomBanner && <Promo banner={cms.bottomBanner} aspect="aspect-[16/3]" />}
        </div>
      </main>

      <Footer categories={categories} />
    </div>
  );

  return (
    <>
      {page}
      {/* phone only: cart shortcut, sits ON TOP of the bottom navbar and stays fixed while scrolling */}
      {count > 0 &&
        createPortal(
          <div
            className="fixed inset-x-0 z-40 p-3 sm:hidden"
            style={{ bottom: `calc(${BOTTOM_NAV_H}px + env(safe-area-inset-bottom, 0px))` }}
          >
            <Link
              to="/cart"
              className="flex items-center justify-between rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-emerald-900/25"
            >
              <span>
                {count} {count === 1 ? "item" : "items"} in your cart
              </span>
              <span>View cart →</span>
            </Link>
          </div>,
          document.body
        )}
    </>
  );
}