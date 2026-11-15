import { WEIGHTS, gramsLabel, packPrice } from "../../utils/weight";
import { inr } from "./Productcard";

type Props = {
  grams: number;
  onChange: (g: number) => void;
  pricePerKg: number;
  maxGrams: number; // stock in kg * 1000
  disabled?: boolean;
};

const STEP = 50;

export default function WeightPicker({
  grams,
  onChange,
  pricePerKg,
  maxGrams,
  disabled,
}: Props) {
  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-medium ring-1 focus:outline-none focus:ring-2 focus:ring-emerald-600/40 disabled:cursor-not-allowed disabled:opacity-40 ${
      active
        ? "bg-emerald-600 text-white ring-emerald-600"
        : "bg-white text-slate-700 ring-slate-300 hover:ring-emerald-600"
    }`;
  const step =
    "flex h-10 w-10 items-center justify-center text-lg text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300";

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-900">Choose weight</p>
      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label="Weight"
      >
        {WEIGHTS.map((w) => (
          <button
            key={w}
            role="radio"
            aria-checked={grams === w}
            disabled={disabled || w > maxGrams}
            onClick={() => onChange(w)}
            className={chip(grams === w)}
          >
            {gramsLabel(w)}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center overflow-hidden rounded-xl ring-1 ring-slate-300">
          <button
            className={step}
            disabled={disabled || grams <= STEP}
            onClick={() => onChange(grams - STEP)}
            aria-label="Less weight"
          >
            −
          </button>
          <span
            className="w-20 text-center text-sm font-medium text-slate-900"
            aria-live="polite"
          >
            {gramsLabel(grams)}
          </span>
          <button
            className={step}
            disabled={disabled || grams + STEP > maxGrams}
            onClick={() => onChange(grams + STEP)}
            aria-label="More weight"
          >
            +
          </button>
        </div>
        <p className="text-sm text-slate-500">
          {inr(packPrice(pricePerKg, 100))} per 100 g ·{" "}
          <span className="font-semibold text-slate-900">
            {inr(packPrice(pricePerKg, grams))}
          </span>{" "}
          for {gramsLabel(grams)}
        </p>
      </div>
    </div>
  );
}
