import { Link } from "react-router-dom";
import type { Deal } from "../../utils/pricing";
import type { Product } from "../../utils/types";

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

type Props = {
  product: Product;
  deal: Deal;
  added: boolean;
  onAdd: () => void;
};

export default function ProductCard({ product, deal, added, onAdd }: Props) {
  const out = product.stock <= 0;
  const low = !out && product.stock <= 5;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="relative aspect-square bg-slate-100">
        <Link to={`/product/${product.id}`} className="block h-full w-full" tabIndex={-1} aria-hidden="true">
          {product.images?.[0] && (
            <img
              src={product.images[0]}
              alt=""
              loading="lazy"
              className={`h-full w-full object-cover ${out ? "opacity-50" : ""}`}
            />
          )}
        </Link>
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
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="line-clamp-2 text-sm font-medium text-slate-900">
          <Link to={`/product/${product.id}`} className="hover:text-emerald-700 focus:outline-none focus-visible:underline">
            {product.name}
          </Link>
        </h3>
        {product.unit && <p className="text-xs text-slate-500">per {product.unit}</p>}
        {deal.bundle && <p className="mt-1 text-xs font-medium text-amber-700">{deal.bundle}</p>}
        {low && <p className="mt-1 text-xs font-medium text-red-600">Only {product.stock} left</p>}

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-base font-semibold text-slate-900">{inr(deal.price)}</span>
          {deal.percentOff > 0 && (
            <span className="text-xs text-slate-400 line-through">{inr(deal.original)}</span>
          )}
        </div>

        <div className="mt-auto pt-3">
          <button
            onClick={onAdd}
            disabled={out}
            className={`w-full rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600/40 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
              added ? "bg-emerald-50 text-emerald-700" : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {out ? "Unavailable" : added ? "Added to cart" : "Add to cart"}
          </button>
        </div>
      </div>
    </article>
  );
}