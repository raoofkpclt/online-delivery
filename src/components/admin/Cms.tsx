import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  getBanners,
  saveBanner,
  removeBanner,
  checkImageSize,
  BANNER_SIZES,
  type Banner,
  type BannerSlot,
  type Banners,
} from "../../service/ cmsservice"; // ← was "../../service/ cmsservice" (stray space), adjust if your file really is named that
import { useConfirm } from "./ConfirmModal";

/* ───────── what each slot is (sizes come from the service) ───────── */

type SlotMeta = { title: string; hint: string };

const SLOTS: Record<BannerSlot, SlotMeta> = {
  mainBanner: {
    title: "Main banner",
    hint: "The big banner at the top of the home page.",
  },
  smallBanner: {
    title: "Small banner",
    hint: "Shown between the two product lists on the home page.",
  },
  poster1: {
    title: "Poster 1",
    hint: "First of the three posters, shown right under the categories.",
  },
  poster2: {
    title: "Poster 2",
    hint: "Second poster in the row.",
  },
  poster3: {
    title: "Poster 3",
    hint: "Third poster in the row.",
  },
  bottomBanner: {
    title: "Bottom banner",
    hint: "The last banner on the home page, below the second product list.",
  },
  shopBanner: {
    title: "Shop page banner",
    hint: "A slim banner at the top of the shop page.",
  },
};

// text-base on phones stops iOS from zooming into inputs
const inputCls =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base text-slate-900 placeholder:text-slate-400 transition " +
  "focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 sm:h-10 sm:text-sm";
const primaryBtn =
  "rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60";
const ghostBtn =
  "rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60";
const dangerBtn =
  "rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 active:bg-red-100 disabled:opacity-60";

const errMsg = (err: unknown) =>
  err instanceof Error
    ? err.message
    : "Something went wrong. Please try again.";

/* ───────── one banner / poster ───────── */

type CardProps = {
  slot: BannerSlot;
  banner: Banner | null;
  onSave: (
    slot: BannerSlot,
    file: File | null,
    link: string,
    alt: string,
  ) => Promise<void>;
  onRemove: (slot: BannerSlot) => Promise<void>;
};

const BannerCard = ({ slot, banner, onSave, onRemove }: CardProps) => {
  const meta = SLOTS[slot];
  const { width, height } = BANNER_SIZES[slot];
  const sizeLabel = `${width} × ${height} px`;
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [link, setLink] = useState(banner?.link ?? "");
  const [alt, setAlt] = useState(banner?.alt ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // keep the fields in step with what is stored
  useEffect(() => {
    setLink(banner?.link ?? "");
    setAlt(banner?.alt ?? "");
  }, [banner]);

  // local preview of a freshly chosen image (before it is uploaded)
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const shown = preview || banner?.url || "";
  const dirty =
    !!file ||
    link.trim() !== (banner?.link ?? "") ||
    alt.trim() !== (banner?.alt ?? "");

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = ""; // lets the same file be chosen again
    if (!f) return;
    setSaved(false);
    try {
      await checkImageSize(slot, f); // reject wrong sizes straight away
      setFile(f);
      setError("");
    } catch (err) {
      setFile(null);
      setError(errMsg(err));
    }
  }

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await onSave(slot, file, link, alt);
      setFile(null);
      setSaved(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await onRemove(slot);
      setFile(null);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200 sm:p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{meta.title}</h3>
          <p className="text-sm text-slate-500">{meta.hint}</p>
        </div>
        <span className="w-fit shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          Required size {sizeLabel}
        </span>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {shown ? (
          <img
            src={shown}
            alt={alt || meta.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center text-sm text-slate-400">
            No image yet
          </div>
        )}
        {file && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
            Not saved yet
          </span>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={pick}
      />

      {/* buttons: full width stack on phones, a row from sm up */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className={`w-full sm:w-auto ${ghostBtn}`}
        >
          {banner || file ? "Choose another image" : "Choose image"}
          <span className="block text-xs font-normal text-slate-400 sm:inline sm:before:content-['_']">
            (exactly {sizeLabel})
          </span>
        </button>
        {file && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setFile(null)}
            className={`w-full sm:w-auto ${ghostBtn}`}
          >
            Discard new image
          </button>
        )}
        {banner && !file && (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className={`w-full sm:w-auto ${dangerBtn}`}
          >
            Remove
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Opens when tapped (optional)
          </span>
          <input
            className={inputCls}
            placeholder="/shop or https://…"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Short description (optional)
          </span>
          <input
            className={inputCls}
            placeholder="e.g. Fresh fruits this week"
            value={alt}
            onChange={(e) => {
              setAlt(e.target.value);
              setSaved(false);
            }}
          />
        </label>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        {saved && !dirty && (
          <span
            role="status"
            className="text-center text-sm font-medium text-emerald-700 sm:text-left"
          >
            Saved
          </span>
        )}
        <button
          type="button"
          disabled={busy || !dirty || !shown}
          onClick={save}
          className={`w-full sm:w-auto ${primaryBtn}`}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
};

/* ───────── page ───────── */

const Section = ({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) => (
  <section className="space-y-3 sm:space-y-4">
    <div>
      <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-slate-500">{note}</p>
    </div>
    <div className="space-y-3 sm:space-y-4">{children}</div>
  </section>
);

const CardSkeleton = () => (
  <div className="animate-pulse rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200 sm:p-4">
    <div className="h-4 w-32 rounded bg-slate-100" />
    <div className="mt-2 h-3 w-48 rounded bg-slate-100" />
    <div className="mt-4 h-32 rounded-xl bg-slate-100 sm:h-40" />
    <div className="mt-3 h-11 rounded-xl bg-slate-100" />
  </div>
);

const Cms = () => {
  const [banners, setBanners] = useState<Banners | null>(null);
  const [loadError, setLoadError] = useState("");
  const { confirm, confirmElement } = useConfirm();

  async function load() {
    try {
      setLoadError("");
      setBanners(await getBanners());
    } catch (err) {
      console.error(err);
      setLoadError(
        "Could not load the page content. Check your connection and try again.",
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(
    slot: BannerSlot,
    file: File | null,
    link: string,
    alt: string,
  ) {
    const saved = await saveBanner(
      slot,
      { file, link, alt },
      banners?.[slot] ?? null,
    );
    setBanners((prev) => (prev ? { ...prev, [slot]: saved } : prev));
  }

  async function handleRemove(slot: BannerSlot) {
    const ok = await confirm({
      title: `Remove ${SLOTS[slot].title.toLowerCase()}?`,
      message:
        "The image will be deleted and customers will no longer see it. This can't be undone.",
      confirmLabel: "Remove",
      cancelLabel: "Keep it",
    });
    if (!ok) return;
    await removeBanner(slot, banners?.[slot] ?? null);
    setBanners((prev) => (prev ? { ...prev, [slot]: null } : prev));
  }

  const card = (slot: BannerSlot) =>
    banners && (
      <BannerCard
        key={slot}
        slot={slot}
        banner={banners[slot]}
        onSave={handleSave}
        onRemove={handleRemove}
      />
    );

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Content
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Change the banners and posters customers see. Each image must be
          exactly the size shown on its card. Each one saves on its own and goes
          live straight away.
        </p>
      </div>

      {loadError && (
        <div
          role="alert"
          className="rounded-2xl bg-white px-5 py-8 text-center text-sm text-red-700 shadow-sm ring-1 ring-slate-200"
        >
          {loadError}{" "}
          <button className="font-medium underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {!banners && !loadError && (
        <div className="space-y-3 sm:space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {banners && (
        <>
          <Section
            title="Home page"
            note="Shown top to bottom in this order. Keep the important part of the main banner near the middle, because phones crop the sides."
          >
            {card("mainBanner")}
            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-700">
                Posters (one row of three, under the categories)
              </h3>
              <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
                {card("poster1")}
                {card("poster2")}
                {card("poster3")}
              </div>
            </div>
            {card("smallBanner")}
            {card("bottomBanner")}
          </Section>

          <Section title="Shop page" note="Shown at the top of the shop page.">
            {card("shopBanner")}
          </Section>
        </>
      )}

      {confirmElement}
    </div>
  );
};

export default Cms;
