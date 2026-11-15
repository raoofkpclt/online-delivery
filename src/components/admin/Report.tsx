import { useCallback, useEffect, useMemo, useState } from "react";
import { getSalesReport, type SalesReport } from "../../service/reportservice";

/* ───────── helpers ───────── */

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const pad = (n: number) => String(n).padStart(2, "0");
/** yyyy-mm-dd in the LOCAL timezone (what <input type="date"> uses) */
const toInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseInput = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const startOfDay = (s: string) => parseInput(s);
const endOfDay = (s: string) => {
  const d = parseInput(s);
  d.setHours(23, 59, 59, 999);
  return d;
};
const fmtDay = (s: string) =>
  parseInput(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

type Preset = "today" | "7d" | "30d" | "month" | "custom";

const PRESETS: { id: Exclude<Preset, "custom">; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
];

function presetRange(p: Exclude<Preset, "custom">): { from: string; to: string } {
  const now = new Date();
  const to = toInput(now);
  if (p === "today") return { from: to, to };
  if (p === "month") return { from: toInput(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  const back = new Date(now);
  back.setDate(back.getDate() - (p === "7d" ? 6 : 29));
  return { from: toInput(back), to };
}

/** Every day from..to, with zeros for days that had no orders (so the chart has no gaps). */
function fillDays(report: SalesReport, from: string, to: string) {
  const map = new Map(report.byDay.map((d) => [d.date, d]));
  const out: { date: string; sales: number; orders: number }[] = [];
  const cur = parseInput(from);
  const end = parseInput(to);
  while (cur <= end && out.length < 366) {
    const key = toInput(cur);
    out.push(map.get(key) ?? { date: key, sales: 0, orders: 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

const RUPEE = '"₹"#,##0';

/** Builds an .xlsx with Summary, Daily and Top products sheets and downloads it. */
async function downloadExcel(
  report: SalesReport,
  days: { date: string; sales: number; orders: number }[],
  from: string,
  to: string
) {
  // loaded only when the button is clicked, so it doesn't add to the page's bundle
  const XLSX = await import("xlsx");
  const money = (v: number) => ({ t: "n" as const, v, z: RUPEE });
  const wb = XLSX.utils.book_new();

  const summary = XLSX.utils.aoa_to_sheet([
    ["Sales report"],
    ["From", { t: "d", v: parseInput(from), z: "dd-mmm-yyyy" }],
    ["To", { t: "d", v: parseInput(to), z: "dd-mmm-yyyy" }],
    [],
    ["Total sales", money(report.totalSales)],
    ["Orders", report.orderCount],
    ["Average order", money(report.averageOrder)],
  ]);
  summary["!cols"] = [{ wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, summary, "Summary");

  const daily = XLSX.utils.aoa_to_sheet([
    ["Date", "Orders", "Sales"],
    ...days.map((d) => [{ t: "d", v: parseInput(d.date), z: "dd-mmm-yyyy" }, d.orders, money(d.sales)]),
    ["Total", report.orderCount, money(report.totalSales)],
  ]);
  daily["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, daily, "Daily");

  const top = XLSX.utils.aoa_to_sheet([
    ["Product", "Quantity sold", "Revenue"],
    ...report.topProducts.map((p) => [p.name, p.quantity, money(p.revenue)]),
  ]);
  top["!cols"] = [{ wch: 32 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, top, "Top products");

  XLSX.writeFile(wb, `sales-report-${from}-to-${to}.xlsx`);
}

// text-base on phones stops iOS from zooming into inputs
const inputCls =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base text-slate-900 transition " +
  "focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 sm:h-10 sm:text-sm";
const ghostBtn =
  "rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60";
const card = "rounded-2xl bg-white shadow-sm ring-1 ring-slate-200";

/* ───────── page ───────── */

const Report = () => {
  const initial = presetRange("30d");
  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!from || !to) return;
    if (from > to) {
      setError("The start date must be on or before the end date.");
      return;
    }
    try {
      setError("");
      setLoading(true);
      setReport(await getSalesReport(startOfDay(from), endOfDay(to)));
    } catch (err) {
      console.error(err);
      setError("Could not load the report. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  function choosePreset(p: Exclude<Preset, "custom">) {
    const r = presetRange(p);
    setPreset(p);
    setFrom(r.from);
    setTo(r.to);
  }

  const days = useMemo(() => (report ? fillDays(report, from, to) : []), [report, from, to]);
  const maxSales = useMemo(() => Math.max(1, ...days.map((d) => d.sales)), [days]);
  const bestDay = useMemo(
    () => days.reduce<(typeof days)[number] | null>((b, d) => (d.sales > (b?.sales ?? 0) ? d : b), null),
    [days]
  );
  const activeDay = days.find((d) => d.date === activeDate) ?? null;
  const topRevenue = report?.topProducts[0]?.revenue || 1;
  const empty = !!report && report.orderCount === 0;

  const stats = report
    ? [
        { label: "Total sales", value: inr(report.totalSales) },
        { label: "Orders", value: report.orderCount.toLocaleString("en-IN") },
        { label: "Average order", value: inr(report.averageOrder) },
        { label: "Best day", value: bestDay ? inr(bestDay.sales) : "—", note: bestDay ? fmtDay(bestDay.date) : "" },
      ]
    : [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* header: buttons share a row on phones */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Sales report</h2>
          <p className="mt-1 text-sm text-slate-500">
            Counts every order except cancelled ones. Cash on delivery, amounts include delivery fees.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button onClick={load} disabled={loading} className={ghostBtn}>
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button
            onClick={() => report && downloadExcel(report, days, from, to)}
            disabled={!report || empty}
            className={ghostBtn}
          >
            Download Excel
          </button>
        </div>
      </div>

      {/* date range */}
      <div className={`${card} space-y-3 p-3 sm:p-4`}>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:inline-flex sm:w-auto">
          {PRESETS.map((p) => {
            const on = preset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => choosePreset(p.id)}
                aria-pressed={on}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition sm:py-1.5 ${
                  on ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:max-w-md sm:gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">From</span>
            <input
              type="date"
              className={inputCls}
              value={from}
              max={to}
              onChange={(e) => {
                setPreset("custom");
                setFrom(e.target.value);
              }}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">To</span>
            <input
              type="date"
              className={inputCls}
              value={to}
              min={from}
              onChange={(e) => {
                setPreset("custom");
                setTo(e.target.value);
              }}
            />
          </label>
        </div>
      </div>

      {error && (
        <div role="alert" className={`${card} px-5 py-6 text-center text-sm text-red-700`}>
          {error}{" "}
          <button className="font-medium underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {/* first load */}
      {loading && !report && (
        <div className="animate-pulse space-y-3 sm:space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-slate-100" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-slate-100" />
        </div>
      )}

      {report && (
        <div className={`space-y-4 sm:space-y-6 ${loading ? "opacity-60 transition-opacity" : ""}`}>
          {/* totals */}
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
            {stats.map((s) => (
              <div key={s.label} className={`${card} min-w-0 p-3.5 sm:p-4`}>
                <dt className="text-xs text-slate-500 sm:text-sm">{s.label}</dt>
                <dd className="mt-1 truncate text-xl font-semibold text-slate-900 sm:text-2xl">{s.value}</dd>
                {s.note && <div className="text-xs text-slate-400">{s.note}</div>}
              </div>
            ))}
          </dl>

          {empty ? (
            <div className={`${card} px-4 py-12 text-center text-sm text-slate-500`}>
              No sales in this period. Try a wider date range.
            </div>
          ) : (
            <>
              {/* sales by day */}
              <section className={`${card} p-3.5 sm:p-4`}>
                <h3 className="font-semibold text-slate-900">Sales by day</h3>
                {/* phones have no hover, so tapping a bar shows its numbers here */}
                <p className="mb-3 mt-0.5 min-h-5 text-sm text-slate-500" aria-live="polite">
                  {activeDay
                    ? `${fmtDay(activeDay.date)}: ${inr(activeDay.sales)} from ${activeDay.orders} ${
                        activeDay.orders === 1 ? "order" : "orders"
                      }`
                    : "Tap a bar to see that day."}
                </p>
                <div className="overflow-x-auto">
                  <div
                    className="flex h-44 items-end gap-1 border-b border-slate-200 sm:h-52"
                    style={{ minWidth: Math.max(days.length * 12, 0) }}
                  >
                    {days.map((d) => {
                      const on = d.date === activeDate;
                      return (
                        <button
                          key={d.date}
                          type="button"
                          onClick={() => setActiveDate(on ? null : d.date)}
                          aria-label={`${fmtDay(d.date)}: ${inr(d.sales)} from ${d.orders} ${d.orders === 1 ? "order" : "orders"}`}
                          aria-pressed={on}
                          title={`${fmtDay(d.date)}: ${inr(d.sales)} from ${d.orders} ${d.orders === 1 ? "order" : "orders"}`}
                          className="group flex h-full flex-1 items-end focus:outline-none"
                        >
                          <span
                            className={`block w-full rounded-t transition ${
                              d.sales > 0
                                ? on
                                  ? "bg-emerald-800"
                                  : "bg-emerald-600 group-hover:bg-emerald-700 group-focus-visible:bg-emerald-700"
                                : "bg-slate-200"
                            }`}
                            style={{ height: d.sales > 0 ? `${Math.max((d.sales / maxSales) * 100, 2)}%` : "2px" }}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-slate-500">
                    <span>{fmtDay(days[0].date)}</span>
                    <span>{fmtDay(days[days.length - 1].date)}</span>
                  </div>
                </div>
              </section>

              <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                {/* top products */}
                <section className={`${card} p-3.5 sm:p-4`}>
                  <h3 className="mb-3 font-semibold text-slate-900">Top products by revenue</h3>
                  <ol className="space-y-3.5">
                    {report.topProducts.map((p) => (
                      <li key={p.productId}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 break-words text-slate-900">{p.name}</span>
                          <span className="shrink-0 whitespace-nowrap font-medium text-slate-700">{inr(p.revenue)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full bg-emerald-600"
                            style={{ width: `${(p.revenue / topRevenue) * 100}%` }}
                          />
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400">{p.quantity} sold</div>
                      </li>
                    ))}
                  </ol>
                </section>

                {/* daily table */}
                <section className={`${card} p-3.5 sm:p-4`}>
                  <h3 className="mb-3 font-semibold text-slate-900">Daily breakdown</h3>
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 border-b border-slate-100 bg-white text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="py-2 font-medium">Date</th>
                          <th className="py-2 text-right font-medium">Orders</th>
                          <th className="py-2 text-right font-medium">Sales</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[...days].reverse().map((d) => (
                          <tr key={d.date} className={d.orders === 0 ? "text-slate-400" : "text-slate-700"}>
                            <td className="whitespace-nowrap py-2.5">{fmtDay(d.date)}</td>
                            <td className="py-2.5 text-right">{d.orders}</td>
                            <td className="whitespace-nowrap py-2.5 text-right">{inr(d.sales)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Report;