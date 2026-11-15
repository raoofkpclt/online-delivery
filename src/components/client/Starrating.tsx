type Props = {
  value: number;
  /** Leave out for a read-only display */
  onChange?: (v: number) => void;
  size?: "sm" | "md" | "lg";
  label?: string;
};

const SIZE = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-8 w-8" };

function Star({ filled, cls }: { filled: boolean; cls: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${cls} ${filled ? "fill-amber-400 text-amber-400" : "fill-transparent text-slate-300"}`}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />
    </svg>
  );
}

/** Reusable 1–5 star display and input. */
export default function StarRating({
  value,
  onChange,
  size = "md",
  label = "Rating",
}: Props) {
  const cls = SIZE[size];

  if (!onChange) {
    return (
      <span
        className="inline-flex"
        role="img"
        aria-label={`${value} out of 5 stars`}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} filled={n <= value} cls={cls} />
        ))}
      </span>
    );
  }

  return (
    <div role="radiogroup" aria-label={label} className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          onClick={() => onChange(value === n ? 0 : n)}
          className="rounded p-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
        >
          <Star filled={n <= value} cls={cls} />
        </button>
      ))}
    </div>
  );
}
