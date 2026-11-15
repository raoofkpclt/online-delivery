import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createCrud } from "../../service/firestoreCrud";
import {
  deleteFile,
  uploadFile,
  UploadError,
} from "../../service/uploadService";
import type { Category, Product } from "../../utils/types";

const crud = createCrud<Category>("categories");

// text-base on phones stops iOS from zooming into inputs
const inputCls =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base text-slate-900 placeholder:text-slate-400 transition " +
  "focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 sm:h-10 sm:text-sm";
const primaryBtn =
  "rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60";
const ghostBtn =
  "rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60";
const rowBtn =
  "rounded-lg px-3 py-2.5 text-sm font-semibold ring-1 transition disabled:opacity-40 sm:py-1.5 sm:text-xs";
const editBtn = `${rowBtn} text-emerald-700 ring-emerald-200 hover:bg-emerald-50 active:bg-emerald-100`;
const deleteBtn = `${rowBtn} text-red-600 ring-red-200 hover:bg-red-50 active:bg-red-100 disabled:cursor-not-allowed`;

type Props = {
  categories: Category[];
  products: Product[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
};

/** A bottom sheet on phones, a centred box from sm up. */
export default function CategoryModal({
  categories,
  products,
  onClose,
  onChanged,
}: Props) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [keepUrl, setKeepUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach((p) =>
      m.set(p.categoryId, (m.get(p.categoryId) ?? 0) + 1),
    );
    return m;
  }, [products]);

  const filePreview = useMemo(
    () => (file ? URL.createObjectURL(file) : ""),
    [file],
  );
  useEffect(
    () => () => (filePreview ? URL.revokeObjectURL(filePreview) : undefined),
    [filePreview],
  );
  const preview = filePreview || keepUrl;

  // Esc closes it, and the page behind does not scroll
  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && !saving && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [saving, onClose]);

  function reset() {
    setEditing(null);
    setName("");
    setIsActive(true);
    setKeepUrl("");
    setFile(null);
    setError("");
  }

  function startEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setIsActive(c.isActive);
    setKeepUrl(c.imageUrl ?? "");
    setFile(null);
    setError("");
    setConfirmId(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    const clean = name.trim();
    if (!clean) return setError("Enter the category name.");
    if (
      categories.some(
        (c) =>
          c.id !== editing?.id &&
          c.name.trim().toLowerCase() === clean.toLowerCase(),
      )
    )
      return setError("A category with this name already exists.");

    setSaving(true);
    let newUrl = ""; // image uploaded in this save
    let wrote = false; // true once the category is saved in Firestore
    try {
      let imageUrl = keepUrl;
      if (file) {
        const up = await uploadFile(file, {
          folder: "categories",
          allowedTypes: ["image/"],
          maxSizeMB: 5,
        });
        imageUrl = up.url;
        newUrl = up.url;
      }
      const data = { name: clean, imageUrl, isActive };

      if (editing) {
        await crud.update(editing.id, data);
        wrote = true;
        // the old image is no longer used
        if (editing.imageUrl && editing.imageUrl !== imageUrl) {
          deleteFile(editing.imageUrl).catch((err) => console.error(err));
        }
      } else {
        await crud.create(data);
        wrote = true;
      }
      await onChanged();
      reset();
    } catch (err) {
      console.error(err);
      // don't leave an unused upload behind if the category was not saved
      if (!wrote && newUrl) deleteFile(newUrl).catch(() => {});
      setError(
        err instanceof UploadError
          ? err.message
          : "Could not save the category. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Category) {
    setDeletingId(c.id);
    try {
      await crud.remove(c.id);
      if (c.imageUrl) deleteFile(c.imageUrl).catch((err) => console.error(err));
      await onChanged();
      if (editing?.id === c.id) reset();
    } catch (err) {
      console.error(err);
      setError("Could not delete the category. Please try again.");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-slate-900/40 sm:items-start sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="categories-title"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:my-6 sm:max-h-none sm:rounded-2xl"
      >
        {/* header stays visible while the content scrolls */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3 sm:px-6">
          <h2
            id="categories-title"
            className="text-base font-semibold text-slate-900 sm:text-lg"
          >
            Categories
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="-mr-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 active:bg-slate-100 disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:space-y-5 sm:p-6">
          {/* add / edit form */}
          <form
            onSubmit={handleSave}
            className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-200"
          >
            <p className="mb-3 text-sm font-semibold text-slate-900">
              {editing ? `Edit ${editing.name}` : "Add category"}
            </p>
            <div className="flex gap-3">
              <label className="relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500 hover:bg-slate-100 active:bg-slate-100">
                {preview ? (
                  <img
                    src={preview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  "Add image"
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.type.startsWith("image/")) setFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  className={inputCls}
                  placeholder="e.g. Leafy vegetables"
                  aria-label="Category name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-600"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  Show in the shop
                </label>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {editing && (
                <button
                  type="button"
                  onClick={reset}
                  className={`w-full sm:w-auto ${ghostBtn}`}
                >
                  Cancel edit
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className={`w-full sm:w-auto ${primaryBtn}`}
              >
                {saving ? "Saving…" : editing ? "Save changes" : "Add category"}
              </button>
            </div>
          </form>

          {/* list */}
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl ring-1 ring-slate-200">
            {categories.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-slate-500">
                No categories yet. Add one above, such as Fruits, Vegetables or
                Dairy.
              </li>
            )}
            {categories.map((c) => {
              const n = counts.get(c.id) ?? 0;
              const deleting = deletingId === c.id;
              return (
                <li
                  key={c.id}
                  className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-100" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {c.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {n} {n === 1 ? "product" : "products"}
                        {!c.isActive && " · hidden"}
                      </p>
                    </div>
                  </div>

                  {confirmId === c.id ? (
                    <div className="flex gap-2 sm:shrink-0">
                      <button
                        onClick={() => setConfirmId(null)}
                        disabled={deleting}
                        className={`flex-1 sm:flex-none ${rowBtn} text-slate-600 ring-slate-200 hover:bg-slate-50 active:bg-slate-100`}
                      >
                        Keep
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        disabled={deleting}
                        className={`flex-1 sm:flex-none ${rowBtn} bg-red-600 text-white ring-red-600 hover:bg-red-700 active:bg-red-800`}
                      >
                        {deleting ? "Deleting…" : "Confirm delete"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 sm:shrink-0">
                      <button
                        onClick={() => startEdit(c)}
                        className={`flex-1 sm:flex-none ${editBtn}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmId(c.id)}
                        disabled={n > 0}
                        title={
                          n > 0
                            ? "Move or delete its products first"
                            : undefined
                        }
                        className={`flex-1 sm:flex-none ${deleteBtn}`}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
