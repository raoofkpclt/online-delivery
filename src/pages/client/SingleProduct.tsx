import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "../../components/client/Navbar";
import Footer from "../../components/client/Footer";
import ProductCard, { inr } from "../../components/client/Productcard";
import WeightPicker from "../../components/client/WeightPicker";
import { useCart } from "../../routes/client/ Cartcontext"; // ← adjust: your cart hook
import { getErrorMessage } from "../../service/authService";
import { createCrud } from "../../service/firestoreCrud";
import { getActiveOffers } from "../../service/offerService";
import { getProducts } from "../../service/productService";
import { getDeal, type Deal } from "../../utils/pricing";
import type { Category, Offer, Product } from "../../utils/types";
import { gramsLabel, isWeighed, packPrice } from "../../utils/weight";

const categoryCrud = createCrud<Category>("categories");

const DEFAULT_GRAMS = 250;

// ← adjust if your Product uses different field names
type ProductExtras = Product & { categoryId?: string; description?: string };
const catOf = (p: Product) => (p as ProductExtras).categoryId ?? "";
const descOf = (p: Product) => (p as ProductExtras).description ?? "";

function Gallery({ images, name, out }: { images: string[]; name: string; out: boolean }) {
  const [i, setI] = useState(0);
  const n = images.length;

  useEffect(() => setI(0), [images]);

  const go = (d: number) => setI((x) => (x + d + n) % n);
  const arrow =
    "absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow ring-1 ring-slate-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/40";

  return (
    <div>
      <div
        className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200"
        onKeyDown={(e) => {
          if (n > 1 && e.key === "ArrowLeft") go(-1);
          if (n > 1 && e.key === "ArrowRight") go(1);
        }}
        tabIndex={n > 1 ? 0 : -1}
        aria-label={`${name} images, ${n > 1 ? "use arrow keys to browse" : "one image"}`}
      >
        {n > 0 ? (
          <img src={images[i]} alt={`${name}, image ${i + 1} of ${n}`} className={`h-full w-full object-cover ${out ? "opacity-60" : ""}`} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">No image available</div>
        )}
        {n > 1 && (
          <>
            <button onClick={() => go(-1)} aria-label="Previous image" className={`${arrow} left-3`}>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 5-5 5 5 5" /></svg>
            </button>
            <button onClick={() => go(1)} aria-label="Next image" className={`${arrow} right-3`}>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 5 5 5-5 5" /></svg>
            </button>
          </>
        )}
      </div>

      {n > 1 && (
        <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {images.map((src, idx) => (
            <li key={src + idx} className="shrink-0">
              <button
                onClick={() => setI(idx)}
                aria-label={`Show image ${idx + 1}`}
                aria-current={idx === i}
                className={`h-16 w-16 overflow-hidden rounded-xl bg-slate-100 ring-2 focus:outline-none sm:h-20 sm:w-20 ${
                  idx === i ? "ring-emerald-600" : "ring-transparent hover:ring-slate-300"
                }`}
              >
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-3 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export default function SingleProduct() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { count, addItem } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [qty, setQty] = useState(1); // used for products that are not sold by weight
  const [grams, setGrams] = useState(DEFAULT_GRAMS); // used for products sold per kg
  const [addedId, setAddedId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([getProducts({ onlyActive: true }), categoryCrud.list(), getActiveOffers()])
      .then(([p, c, o]) => {
        if (!alive) return;
        setProducts(p);
        setCategories(c.filter((x) => x.isActive));
        setOffers(o);
      })
      .catch((e) => alive && setError(getErrorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => () => {
  if (timer.current) {
    clearTimeout(timer.current);
  }
}, []);



  // new product: back to the top, quantity 1, default weight
  useEffect(() => {
    setQty(1);
    setGrams(DEFAULT_GRAMS);
    window.scrollTo({ top: 0 });
  }, [id]);

  const product = useMemo(() => products.find((p) => p.id === id) ?? null, [products, id]);
  const deal = useMemo(() => (product ? getDeal(product, offers) : null), [product, offers]);
  const category = product ? categories.find((c) => c.id === catOf(product)) : undefined;

  useEffect(() => {
    if (product) document.title = `${product.name} | Rahath`;
  }, [product]);

  const related = useMemo(() => {
    if (!product) return [];
    const others = products
      .filter((p) => p.id !== product.id && p.stock > 0)
      .map((p) => ({ product: p, deal: getDeal(p, offers) }));
    const cat = catOf(product);
    const same = others.filter((x) => cat && catOf(x.product) === cat);
    const rest = others.filter((x) => !same.includes(x));
    return [...same, ...rest].slice(0, 4);
  }, [products, product, offers]);

  const out = !!product && product.stock <= 0;
  const weighed = !!product && isWeighed(product);

  // piece products: whole units. kg products: grams, capped by the stock left
  const maxQty = product ? Math.max(1, product.stock) : 1;
  const maxGrams = product ? Math.max(0, product.stock * 1000) : 0;
  const shownGrams = Math.min(grams, maxGrams);

  // price of what the shopper has picked right now
  const linePrice = deal ? (weighed ? packPrice(deal.price, shownGrams) : deal.price * qty) : 0;

  const stockText = !product
    ? ""
    : out
      ? "Out of stock"
      : product.stock <= 5
        ? `Only ${product.stock}${weighed ? ` ${product.unit}` : ""} left`
        : "In stock";

  function flashAdded(productId: string) {
  setAddedId(productId);

  if (timer.current) {
    clearTimeout(timer.current);
  }

  timer.current = setTimeout(() => setAddedId(null), 1500);
}

  // one place that builds the cart line, so Add, Buy now and Related all agree
  function pushToCart(p: Product, d: Deal, opts: { qty?: number; grams?: number }) {
    if (opts.grams) {
      // kg product: the cart keeps ONE line per product holding the total grams;
      // adding more of the same product adds to its weight
      addItem({ ...p, price: packPrice(d.price, opts.grams), grams: opts.grams, ratePerKg: d.price }, 1);
    } else {
      addItem({ ...p, price: d.price }, opts.qty ?? 1); // add at the offer price
    }
  }

  function add() {
    if (!product || !deal) return;
    pushToCart(product, deal, weighed ? { grams: shownGrams } : { qty });
    flashAdded(product.id);
  }

  function buyNow() {
    if (!product || !deal) return;
    pushToCart(product, deal, weighed ? { grams: shownGrams } : { qty });
    navigate("/checkout");
  }

  // related cards show the per-kg price, so a kg product is added as 1 kg
  function addRelated(p: Product, d: Deal) {
    pushToCart(p, d, isWeighed(p) ? { grams: 1000 } : { qty: 1 });
    flashAdded(p.id);
  }

  const stepBtn =
    "flex h-10 w-10 items-center justify-center text-lg text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/40 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent";

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar cartCount={count} />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* breadcrumb: hidden on mobile, visible from the sm breakpoint up */}
        <nav aria-label="Breadcrumb" className="hidden flex-wrap items-center text-sm text-slate-500 sm:flex">
          <Link to="/" className="hover:text-slate-800">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/shop" className="hover:text-slate-800">Shop</Link>
          {category && (
            <>
              <span className="mx-2">/</span>
              <Link to={`/shop?category=${category.id}`} className="hover:text-slate-800">{category.name}</Link>
            </>
          )}
          {product && (
            <>
              <span className="mx-2">/</span>
              <span className="line-clamp-1 text-slate-800">{product.name}</span>
            </>
          )}
        </nav>

        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100 sm:mt-5">
            <span>{error}</span>
            <button onClick={() => setReloadKey((k) => k + 1)} className="font-semibold underline">Try again</button>
          </div>
        )}

        {loading ? (
          <div className="grid gap-10 sm:mt-6 lg:grid-cols-2">
            <div className="aspect-square animate-pulse rounded-2xl bg-slate-200/70" />
            <div className="space-y-4">
              <div className="h-8 w-3/4 animate-pulse rounded-lg bg-slate-200/70" />
              <div className="h-6 w-1/3 animate-pulse rounded-lg bg-slate-200/70" />
              <div className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />
            </div>
          </div>
        ) : !product || !deal ? (
          !error && (
            <div className="rounded-2xl bg-white px-6 py-16 text-center ring-1 ring-slate-200 sm:mt-8">
              <p className="text-base font-semibold text-slate-900">We could not find this product</p>
              <p className="mt-1 text-sm text-slate-500">It may have been removed or is no longer available.</p>
              <Link to="/shop" className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700">
                Browse all products
              </Link>
            </div>
          )
        ) : (
          <>
            <div className="grid items-start gap-8 sm:mt-6 lg:grid-cols-2 lg:gap-12">
              <Gallery images={product.images ?? []} name={product.name} out={out} />

              <div>
                {category && (
                  <Link to={`/shop?category=${category.id}`} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
                    {category.name}
                  </Link>
                )}
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{product.name}</h1>
                {product.unit && <p className="mt-1 text-sm text-slate-500">Sold per {product.unit}</p>}

                <div className="mt-5 flex flex-wrap items-baseline gap-3">
                  <span className="text-3xl font-semibold text-slate-900">
                    {inr(deal.price)}
                    {weighed && <span className="ml-1 text-base font-normal text-slate-500">/ {product.unit}</span>}
                  </span>
                  {deal.percentOff > 0 && (
                    <>
                      <span className="text-base text-slate-400 line-through">{inr(deal.original)}</span>
                      <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                        {deal.percentOff}% off
                      </span>
                    </>
                  )}
                </div>
                {deal.percentOff > 0 && (
                  <p className="mt-1 text-sm text-emerald-700">You save {inr(deal.original - deal.price)}{product.unit ? ` per ${product.unit}` : ""}</p>
                )}
                {deal.bundle && (
                  <p className="mt-3 inline-block rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800">{deal.bundle}</p>
                )}

                <p className={`mt-4 text-sm font-medium ${out ? "text-red-600" : product.stock <= 5 ? "text-amber-700" : "text-emerald-700"}`}>
                  {stockText}
                </p>

                {/* weight options (kg products only) */}
                {weighed && (
                  <div className="mt-6">
                    <WeightPicker
                      grams={shownGrams}
                      onChange={setGrams}
                      pricePerKg={deal.price}
                      maxGrams={maxGrams}
                      disabled={out}
                    />
                  </div>
                )}

                {/* quantity + actions */}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {!weighed && (
                    <div className="inline-flex items-center overflow-hidden rounded-xl ring-1 ring-slate-300">
                      <button className={stepBtn} onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={out || qty <= 1} aria-label="Decrease quantity">−</button>
                      <span className="w-10 text-center text-sm font-medium text-slate-900" aria-live="polite">{qty}</span>
                      <button className={stepBtn} onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={out || qty >= maxQty} aria-label="Increase quantity">+</button>
                    </div>
                  )}

                  <button
                    onClick={add}
                    disabled={out}
                    className={`min-w-40 flex-1 rounded-xl px-6 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600/40 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:flex-none ${
                      addedId === product.id ? "bg-emerald-50 text-emerald-700" : "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700"
                    }`}
                  >
                    {out
                      ? "Unavailable"
                      : addedId === product.id
                        ? "Added to cart"
                        : weighed
                          ? `Add ${gramsLabel(shownGrams)} to cart`
                          : "Add to cart"}
                  </button>

                  <button
                    onClick={buyNow}
                    disabled={out}
                    className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Buy now
                  </button>
                </div>
                {!out && (weighed || qty > 1) && (
                  <p className="mt-3 text-sm text-slate-500">
                    Total for {weighed ? gramsLabel(shownGrams) : qty}:{" "}
                    <span className="font-semibold text-slate-900">{inr(linePrice)}</span>
                  </p>
                )}

                {/* delivery info */}
                <ul className="mt-6 space-y-2.5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
                  {["Cash on delivery available", "Delivered to your door", "Pay only when your order reaches you"].map((t) => (
                    <li key={t} className="flex items-center gap-2.5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white" aria-hidden="true">
                        <svg viewBox="0 0 20 20" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 10 3.5 3.5L15 7" /></svg>
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>

                {/* details */}
                <section className="mt-8" aria-labelledby="details-h">
                  <h2 id="details-h" className="text-base font-semibold text-slate-900">Product details</h2>
                  <dl className="mt-2 divide-y divide-slate-200 border-y border-slate-200">
                    {category && <Row label="Category" value={category.name} />}
                    {product.unit && <Row label="Sold per" value={product.unit} />}
                    {weighed && <Row label="Weights available" value="100 g, 250 g, 500 g, 1 kg or custom" />}
                    <Row label="Price" value={deal.percentOff > 0 ? `${inr(deal.price)} (was ${inr(deal.original)})` : inr(deal.price)} />
                    <Row label="Availability" value={stockText} />
                  </dl>
                </section>

                {descOf(product) && (
                  <section className="mt-8" aria-labelledby="desc-h">
                    <h2 id="desc-h" className="text-base font-semibold text-slate-900">About this product</h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{descOf(product)}</p>
                  </section>
                )}
              </div>
            </div>

            {related.length > 0 && (
              <section className="mt-16" aria-labelledby="related-h">
                <div className="mb-4 flex items-end justify-between">
                  <h2 id="related-h" className="text-xl font-semibold text-slate-900">Related products</h2>
                  <Link to={category ? `/shop?category=${category.id}` : "/shop"} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
                    View more
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
                  {related.map(({ product: p, deal: d }) => (
                    <ProductCard key={p.id} product={p} deal={d} added={addedId === p.id} onAdd={() => addRelated(p, d)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <Footer categories={categories} />
    </div>
  );
}