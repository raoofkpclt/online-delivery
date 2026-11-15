import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createCrud } from "../../service/firestoreCrud";
import {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  isProductCodeTaken,
} from "../../service/productService";
import {
  deleteFilesByUrl,
  uploadMultipleFiles,
  UploadError,
} from "../../service/uploadService";
import type { Category, Offer, Product } from "../../utils/types";
import { getOffers, updateOffer } from "../../service/offerService";
import CategoryModal from "./Categorymodal";

const categoryCrud = createCrud<Category>("categories");

const UNITS = ["kg", "500 g", "250 g", "piece", "dozen", "bunch", "litre", "pack"];
const LOW_STOCK = 5;
const MAX_IMAGES = 5;
const MAX_IMAGE_MB = 5;

type FormState = {
  name: string;
  code: string;
  description: string;
  categoryId: string;
  price: string;
  stock: string;
  unit: string;
  isActive: boolean;
  offerIds: string[];
};

const emptyForm: FormState = {
  name: "",
  code: "",
  description: "",
  categoryId: "",
  price: "",
  stock: "",
  unit: "kg",
  isActive: true,
  offerIds: [],
};

/** Content of the alert modal. Add actionLabel + onAction to show a second button (e.g. "Try again"). */
type AlertInfo = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function generateCode(prefix: string) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "PRD"}-${s}`;
}

function offerIsLive(o: Offer) {
  const now = Date.now();
  return o.isActive && o.startsAt.toMillis() <= now && o.endsAt.toMillis() >= now;
}

// text-base on phones stops iPhones zooming into the field, compact text from sm up
const inputCls =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900 sm:py-2 sm:text-sm " +
  "placeholder:text-stone-400 focus:border-[#2f6b3a] focus:outline-none focus:ring-2 focus:ring-[#2f6b3a]/25";

/* ───────── small pieces ───────── */

function StatusSwitch({ p, onToggle }: { p: Product; onToggle: (p: Product) => void }) {
  return (
    <button
      role="switch"
      aria-checked={p.isActive}
      aria-label={`${p.name} is ${p.isActive ? "active" : "inactive"}`}
      onClick={() => onToggle(p)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2f6b3a]/40 ${
        p.isActive ? "bg-[#2f6b3a]" : "bg-stone-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
          p.isActive ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function StockText({ p }: { p: Product }) {
  return (
    <span
      className={
        p.stock === 0
          ? "font-medium text-red-700"
          : p.stock <= LOW_STOCK
          ? "font-medium text-amber-700"
          : "text-stone-700"
      }
    >
      {p.stock === 0 ? "Out of stock" : p.stock}
    </span>
  );
}

function OfferChips({ live }: { live: Offer[] }) {
  if (live.length === 0) return <span className="text-stone-400">None</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {live.slice(0, 2).map((o) => (
        <span key={o.id} className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
          {o.title}
        </span>
      ))}
      {live.length > 2 && <span className="text-xs text-stone-500">+{live.length - 2}</span>}
    </div>
  );
}

/** Popup for errors and notices. A bottom sheet on phones, a centred box from sm up. */
function AlertModal({ info, onClose }: { info: AlertInfo; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-title"
        aria-describedby="alert-message"
        className="w-full max-w-sm rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-xl sm:pb-5"
      >
        <div className="flex gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-base font-semibold text-red-700"
            aria-hidden="true"
          >
            !
          </span>
          <div className="min-w-0">
            <h2 id="alert-title" className="text-base font-semibold text-stone-900">
              {info.title}
            </h2>
            <p id="alert-message" className="mt-1 text-sm text-stone-600">
              {info.message}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            autoFocus={!info.actionLabel}
            onClick={onClose}
            className="w-full rounded-md border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 sm:w-auto sm:py-2"
          >
            {info.actionLabel ? "Close" : "OK"}
          </button>
          {info.actionLabel && (
            <button
              autoFocus
              onClick={() => {
                onClose();
                info.onAction?.();
              }}
              className="w-full rounded-md bg-[#2f6b3a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#265730] sm:w-auto sm:py-2"
            >
              {info.actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Thumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative h-20 w-20">
      <img src={src} alt="" className="h-full w-full rounded-md object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove image"
        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-stone-800 text-sm text-white hover:bg-red-700"
      >
        ×
      </button>
    </div>
  );
}

/* ───────── page ───────── */

const ProductManagement = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // filters
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");

  // modal / form
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [keptImages, setKeptImages] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(""); // field problems, shown inside the form

  const [catsOpen, setCatsOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // popup for errors and notices
  const [alertInfo, setAlertInfo] = useState<AlertInfo | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(false);
      const [p, c, o] = await Promise.all([
        getProducts(),
        categoryCrud.list(),
        getOffers(),
      ]);
      setProducts(p);
      setCategories(c);
      setOffers(o);
    } catch (err) {
      console.error(err);
      setLoadError(true);
      setAlertInfo({
        title: "Could not load products",
        message: "Check your connection and try again.",
        actionLabel: "Try again",
        onAction: () => {
          setLoading(true);
          void load();
        },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const catName = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  // Offers an admin can attach to individual products
  const linkableOffers = useMemo(
    () =>
      offers.filter(
        (o) => o.offerType === "product_discount" || o.offerType === "buy_x_get_y"
      ),
    [offers]
  );

  const liveOffersFor = useCallback(
    (p: Product) =>
      offers.filter(
        (o) =>
          offerIsLive(o) &&
          (o.targetProductIds.includes(p.id) ||
            o.targetCategoryIds.includes(p.categoryId))
      ),
    [offers]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (catFilter && p.categoryId !== catFilter) return false;
      if (statusFilter === "active" && !p.isActive) return false;
      if (statusFilter === "inactive" && p.isActive) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.code ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, search, catFilter, statusFilter]);

  // Local previews for files picked but not uploaded yet
  const newPreviews = useMemo(
    () => newFiles.map((f) => URL.createObjectURL(f)),
    [newFiles]
  );
  useEffect(() => () => newPreviews.forEach(URL.revokeObjectURL), [newPreviews]);

  // popups: Esc closes the top one, and the page behind does not scroll
  const anyModal = open || !!toDelete || !!alertInfo;
  useEffect(() => {
    if (!anyModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (alertInfo) setAlertInfo(null);
      else if (toDelete && !deleting) setToDelete(null);
      else if (open && !saving && !catsOpen) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [anyModal, alertInfo, toDelete, deleting, open, saving, catsOpen]);

  /* ───────── form helpers ───────── */
  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm, code: generateCode("") });
    setKeptImages([]);
    setNewFiles([]);
    setFormError("");
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      code: p.code ?? "",
      description: p.description,
      categoryId: p.categoryId,
      price: String(p.price),
      stock: String(p.stock),
      unit: p.unit ?? "kg",
      isActive: p.isActive,
      offerIds: linkableOffers
        .filter((o) => o.targetProductIds.includes(p.id))
        .map((o) => o.id),
    });
    setKeptImages(p.images ?? []);
    setNewFiles([]);
    setFormError("");
    setOpen(true);
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function pickFiles(list: FileList | null) {
    if (!list) return;
    setFormError("");
    const room = Math.max(MAX_IMAGES - keptImages.length - newFiles.length, 0);
    const images = Array.from(list).filter((f) => f.type.startsWith("image/"));
    const fits = images.filter((f) => f.size <= MAX_IMAGE_MB * 1024 * 1024);

    if (fits.length < images.length) {
      setAlertInfo({
        title: "Some images were skipped",
        message: `Each image must be ${MAX_IMAGE_MB} MB or smaller. Larger ones were not added.`,
      });
    } else if (fits.length > room) {
      setAlertInfo({
        title: "Image limit reached",
        message: `A product can have up to ${MAX_IMAGES} images. Extra images were not added.`,
      });
    }
    setNewFiles((prev) => [...prev, ...fits.slice(0, room)]);
  }

  function toggleOffer(id: string) {
    set(
      "offerIds",
      form.offerIds.includes(id)
        ? form.offerIds.filter((x) => x !== id)
        : [...form.offerIds, id]
    );
  }

  async function syncOffers(productId: string, selected: string[]) {
    const changed = linkableOffers.filter(
      (o) => o.targetProductIds.includes(productId) !== selected.includes(o.id)
    );
    await Promise.all(
      changed.map((o) =>
        updateOffer(o.id, {
          targetProductIds: selected.includes(o.id)
            ? [...o.targetProductIds, productId]
            : o.targetProductIds.filter((x) => x !== productId),
        })
      )
    );
  }

  /* ───────── save ───────── */
  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setFormError("");

    const code = form.code.trim().toUpperCase();
    const price = Number(form.price);
    const stock = Number(form.stock);

    if (!form.name.trim()) return setFormError("Enter the product name.");
    if (!code) return setFormError("Enter a product code.");
    if (!/^[A-Z0-9-]{3,20}$/.test(code))
      return setFormError("Code can use letters, numbers and hyphens (3–20 characters).");
    if (!form.categoryId) return setFormError("Choose a category.");
    if (!(price > 0)) return setFormError("Enter a price greater than 0.");
    if (!Number.isInteger(stock) || stock < 0)
      return setFormError("Stock must be a whole number, 0 or more.");
    if (keptImages.length + newFiles.length === 0)
      return setFormError("Add at least one product image.");

    setSaving(true);
    let uploadedUrls: string[] = []; // images uploaded during this save
    let wrote = false; // true once the product is saved in Firestore
    try {
      if (await isProductCodeTaken(code, editing?.id)) {
        setFormError(`The code ${code} is already used by another product.`);
        return;
      }

      // Upload new images to S3 (if one fails, the others are removed again)
      const files = await uploadMultipleFiles(newFiles, {
        folder: `products/${code}`,
        allowedTypes: ["image/"],
        maxSizeMB: MAX_IMAGE_MB,
      });
      uploadedUrls = files.map((f) => f.url);

      const data = {
        name: form.name.trim(),
        code,
        description: form.description.trim(),
        categoryId: form.categoryId,
        price,
        stock,
        unit: form.unit,
        isActive: form.isActive,
        images: [...keptImages, ...uploadedUrls],
      };

      let productId: string;
      if (editing) {
        productId = editing.id;
        await updateProduct(productId, data);
        wrote = true;
        // delete images the admin removed from this product
        await deleteFilesByUrl((editing.images ?? []).filter((u) => !keptImages.includes(u)));
      } else {
        productId = await addProduct(data);
        wrote = true;
      }

      await syncOffers(productId, form.offerIds);
      await load();
      setOpen(false);
    } catch (err) {
      console.error(err);
      // product was not saved, so don't leave the new uploads behind
      if (!wrote && uploadedUrls.length) void deleteFilesByUrl(uploadedUrls);
      setAlertInfo({
        title: "Could not save the product",
        message:
          err instanceof UploadError
            ? err.message
            : "Something went wrong while saving. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  /* ───────── quick actions ───────── */
  async function toggleActive(p: Product) {
    setProducts((list) =>
      list.map((x) => (x.id === p.id ? { ...x, isActive: !p.isActive } : x))
    );
    try {
      await updateProduct(p.id, { isActive: !p.isActive });
    } catch (err) {
      console.error(err);
      setProducts((list) =>
        list.map((x) => (x.id === p.id ? { ...x, isActive: p.isActive } : x))
      );
      setAlertInfo({
        title: "Could not change the status",
        message: `${p.name} was left ${p.isActive ? "active" : "inactive"}. Please try again.`,
      });
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    setDeleting(true);
    try {
      await deleteProduct(target.id);
      await deleteFilesByUrl(target.images ?? []);
      await syncOffers(target.id, []); // detach from any offers
      await load();
      setToDelete(null);
    } catch (err) {
      console.error(err);
      setToDelete(null);
      setAlertInfo({
        title: "Could not delete the product",
        message: `${target.name} may not have been removed completely. Refresh the list and try again.`,
        actionLabel: "Refresh list",
        onAction: () => void load(),
      });
    } finally {
      setDeleting(false);
    }
  }

  /* ───────── render ───────── */
  const showEmptyState = loading || visible.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
        <div>
          <h1 className="text-xl font-semibold text-stone-900 sm:text-2xl">Products</h1>
          <p className="text-sm text-stone-500">
            {products.length} items in your catalogue
          </p>
        </div>
        {/* phone: two equal buttons across the row */}
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            onClick={() => setCatsOpen(true)}
            className="flex-1 rounded-md border border-[#2f6b3a] px-4 py-2.5 text-sm font-medium text-[#2f6b3a] hover:bg-[#2f6b3a]/5 focus:outline-none focus:ring-2 focus:ring-[#2f6b3a]/40 sm:flex-none sm:py-2"
          >
            Add category
          </button>
          <button
            onClick={openAdd}
            className="flex-1 rounded-md bg-[#2f6b3a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#265730] focus:outline-none focus:ring-2 focus:ring-[#2f6b3a]/40 sm:flex-none sm:py-2"
          >
            Add product
          </button>
        </div>
      </header>

      {/* filters: stacked on phones, one row from md */}
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-[1fr_200px_160px]">
        <input
          type="search"
          className={inputCls + " col-span-2 md:col-span-1"}
          placeholder="Search by name or code"
          aria-label="Search products"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={inputCls}
          aria-label="Filter by category"
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={inputCls}
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {showEmptyState ? (
        <div className="rounded-lg border border-stone-200 bg-white px-4 py-10 text-center text-sm text-stone-500">
          {loading ? (
            "Loading products…"
          ) : loadError ? (
            <>
              Products could not be loaded.{" "}
              <button
                className="font-medium text-[#2f6b3a] underline"
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
              >
                Try again
              </button>
            </>
          ) : products.length === 0 ? (
            "No products yet. Add your first product to start selling."
          ) : (
            "No products match these filters."
          )}
        </div>
      ) : (
        <>
          {/* phones and tablets: one card per product, no sideways scrolling */}
          <ul className="grid gap-3 sm:grid-cols-2 xl:hidden">
            {visible.map((p) => (
              <li key={p.id} className="min-w-0 rounded-xl border border-stone-200 bg-white p-3">
                <div className="flex items-start gap-3">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-md bg-stone-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-medium text-stone-900">{p.name}</p>
                    <p className="text-xs text-stone-500">{p.code}</p>
                    <p className="mt-1 text-sm text-stone-700">
                      {inr(p.price)}
                      {p.unit && <span className="text-stone-400"> / {p.unit}</span>}
                    </p>
                  </div>
                  <StatusSwitch p={p} onToggle={toggleActive} />
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-stone-500">Category</dt>
                    <dd className="truncate text-stone-700">{catName.get(p.categoryId) ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-stone-500">Stock</dt>
                    <dd>
                      <StockText p={p} />
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-stone-500">Offers</dt>
                    <dd>
                      <OfferChips live={liveOffersFor(p)} />
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openEdit(p)}
                    className="rounded-md border border-[#2f6b3a] py-2.5 text-sm font-medium text-[#2f6b3a] hover:bg-[#2f6b3a]/5 active:bg-[#2f6b3a]/10"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setToDelete(p)}
                    className="rounded-md border border-red-200 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 active:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* large screens: table */}
          <div className="hidden overflow-x-auto rounded-lg border border-stone-200 bg-white xl:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Offers</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visible.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt="" className="h-11 w-11 rounded-md object-cover" />
                        ) : (
                          <div className="h-11 w-11 rounded-md bg-stone-100" />
                        )}
                        <div>
                          <div className="font-medium text-stone-900">{p.name}</div>
                          <div className="text-xs text-stone-500">{p.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-stone-700">{catName.get(p.categoryId) ?? "—"}</td>
                    <td className="px-4 py-3 text-stone-700">
                      {inr(p.price)}
                      {p.unit && <span className="text-stone-400"> / {p.unit}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StockText p={p} />
                    </td>
                    <td className="px-4 py-3">
                      <OfferChips live={liveOffersFor(p)} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusSwitch p={p} onToggle={toggleActive} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button onClick={() => openEdit(p)} className="mr-3 text-[#2f6b3a] hover:underline">
                        Edit
                      </button>
                      <button onClick={() => setToDelete(p)} className="text-red-700 hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* add / edit modal: full-width sheet on phones, centred box from sm up */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          onMouseDown={(e) => e.target === e.currentTarget && !saving && setOpen(false)}
        >
          <form
            onSubmit={handleSave}
            noValidate
            className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[90dvh] sm:rounded-xl"
          >
            {/* title stays visible */}
            <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 sm:px-6 sm:py-4">
              <h2 className="text-lg font-semibold text-stone-900">
                {editing ? "Edit product" : "Add product"}
              </h2>
              <button
                type="button"
                disabled={saving}
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-stone-500 hover:bg-stone-100 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {/* only this part scrolls */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-stone-700">Product name</span>
                  <input
                    className={inputCls}
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="e.g. Fresh tomato"
                    autoCapitalize="words"
                    enterKeyHint="next"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-stone-700">Product code</span>
                  <div className="flex gap-2">
                    <input
                      className={inputCls + " min-w-0 uppercase"}
                      value={form.code}
                      onChange={(e) => set("code", e.target.value.toUpperCase())}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => set("code", generateCode(catName.get(form.categoryId) ?? ""))}
                      className="shrink-0 rounded-md border border-stone-300 px-3 text-sm text-stone-700 hover:bg-stone-50 active:bg-stone-100"
                    >
                      Generate
                    </button>
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-stone-700">Category</span>
                  <select
                    className={inputCls}
                    value={form.categoryId}
                    onChange={(e) => set("categoryId", e.target.value)}
                  >
                    <option value="">Choose a category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setCatsOpen(true)}
                    className="mt-1 py-1 text-xs text-[#2f6b3a] hover:underline"
                  >
                    + New category
                  </button>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-stone-700">Price (₹)</span>
                  <input
                    type="number"
                    inputMode="decimal" // number keypad with a decimal point
                    min="0"
                    step="0.01"
                    className={inputCls}
                    value={form.price}
                    onChange={(e) => set("price", e.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-stone-700">Sold per</span>
                  <select
                    className={inputCls}
                    value={form.unit}
                    onChange={(e) => set("unit", e.target.value)}
                  >
                    {UNITS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-stone-700">Stock available</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    className={inputCls}
                    value={form.stock}
                    onChange={(e) => set("stock", e.target.value)}
                  />
                </label>

                <div className="flex items-end">
                  <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[#2f6b3a] sm:h-4 sm:w-4"
                      checked={form.isActive}
                      onChange={(e) => set("isActive", e.target.checked)}
                    />
                    Show this product in the shop
                  </label>
                </div>

                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-stone-700">Description</span>
                  <textarea
                    rows={3}
                    className={inputCls}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="Origin, freshness, how to store…"
                  />
                </label>

                {/* images */}
                <div className="sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-stone-700">
                    Images{" "}
                    <span className="font-normal text-stone-500">
                      ({keptImages.length + newFiles.length}/{MAX_IMAGES}, the first is the cover,
                      max {MAX_IMAGE_MB} MB each)
                    </span>
                  </span>
                  <div className="flex flex-wrap gap-3 pt-1">
                    {keptImages.map((url) => (
                      <Thumb
                        key={url}
                        src={url}
                        onRemove={() => setKeptImages((l) => l.filter((u) => u !== url))}
                      />
                    ))}
                    {newPreviews.map((url, i) => (
                      <Thumb
                        key={url}
                        src={url}
                        onRemove={() => setNewFiles((l) => l.filter((_, j) => j !== i))}
                      />
                    ))}
                    {keptImages.length + newFiles.length < MAX_IMAGES && (
                      <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border border-dashed border-stone-300 text-center text-xs text-stone-500 hover:bg-stone-50 active:bg-stone-100">
                        Add photo
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            pickFiles(e.target.files);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* offers */}
                <div className="sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-stone-700">
                    Offers on this product
                  </span>
                  {linkableOffers.length === 0 ? (
                    <p className="text-sm text-stone-500">
                      No product offers created yet. Create one in Offers, then attach it here.
                    </p>
                  ) : (
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-stone-200 p-2">
                      {linkableOffers.map((o) => (
                        <label
                          key={o.id}
                          className="flex min-h-10 cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-stone-50"
                        >
                          <input
                            type="checkbox"
                            className="h-5 w-5 shrink-0 accent-[#2f6b3a] sm:h-4 sm:w-4"
                            checked={form.offerIds.includes(o.id)}
                            onChange={() => toggleOffer(o.id)}
                          />
                          <span className="min-w-0 text-stone-800">{o.title}</span>
                          {!offerIsLive(o) && (
                            <span className="shrink-0 text-xs text-stone-400">not running now</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-stone-500">
                    Coupon codes apply to the whole cart at checkout, so you manage them in
                    Coupons rather than per product.
                  </p>
                </div>
              </div>
            </div>

            {/* buttons stay visible, so the admin never has to scroll to save */}
            <div className="border-t border-stone-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
              {formError && (
                <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                  {formError}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setOpen(false)}
                  className="w-full rounded-md border border-stone-300 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 sm:w-auto sm:py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-md bg-[#2f6b3a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#265730] disabled:opacity-60 sm:w-auto sm:py-2"
                >
                  {saving ? "Saving…" : editing ? "Save changes" : "Add product"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {catsOpen && (
        <CategoryModal
          categories={categories}
          products={products}
          onClose={() => setCatsOpen(false)}
          onChanged={load}
        />
      )}

      {/* delete confirm */}
      {toDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          onMouseDown={(e) => e.target === e.currentTarget && !deleting && setToDelete(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            className="w-full max-w-sm rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-xl sm:pb-5"
          >
            <h2 id="delete-title" className="text-lg font-semibold text-stone-900">
              Delete this product?
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              {toDelete.name} ({toDelete.code}) and its images will be removed. Past orders keep
              their own copy of the name and price. To hide it without deleting, switch its status
              to inactive.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                disabled={deleting}
                onClick={() => setToDelete(null)}
                className="w-full rounded-md border border-stone-300 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 sm:w-auto sm:py-2"
              >
                Keep product
              </button>
              <button
                disabled={deleting}
                onClick={confirmDelete}
                className="w-full rounded-md bg-red-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60 sm:w-auto sm:py-2"
              >
                {deleting ? "Deleting…" : "Delete product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* errors and notices */}
      {alertInfo && <AlertModal info={alertInfo} onClose={() => setAlertInfo(null)} />}
    </div>
  );
};

export default ProductManagement;