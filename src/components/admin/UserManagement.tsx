import { useCallback, useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "../../service/authService";
import { getAllUsers, setUserBlocked } from "../../service/userService";
import type { UserProfile } from "../../utils/types";
import { useConfirm } from "./ConfirmModal";

type Filter = "all" | "active" | "blocked";

/** Content of the alert modal. Add actionLabel + onAction to show a second button (e.g. "Try again"). */
type AlertInfo = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const joined = (u: UserProfile) =>
  u.createdAt
    ? u.createdAt.toDate().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const initials = (u: UserProfile) => (u.name || u.email).slice(0, 2).toUpperCase();

/** Popup for errors. A bottom sheet on phones, a centred box from sm up. */
function AlertModal({ info, onClose }: { info: AlertInfo; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-title"
        aria-describedby="alert-message"
        className="w-full max-w-sm rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl sm:pb-5"
      >
        <div className="flex gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-base font-semibold text-red-700"
            aria-hidden="true"
          >
            !
          </span>
          <div className="min-w-0">
            <h2 id="alert-title" className="text-base font-semibold text-slate-900">
              {info.title}
            </h2>
            <p id="alert-message" className="mt-1 text-sm text-slate-600">
              {info.message}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            autoFocus={!info.actionLabel}
            onClick={onClose}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 sm:w-auto"
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
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 sm:w-auto"
            >
              {info.actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  // popup for errors
  const [alertInfo, setAlertInfo] = useState<AlertInfo | null>(null);

  const { confirm, confirmElement } = useConfirm();

  const load = useCallback(async () => {
    try {
      setLoadFailed(false);
      setUsers(await getAllUsers());
    } catch (e) {
      setLoadFailed(true);
      setAlertInfo({
        title: "Could not load users",
        message: getErrorMessage(e),
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

  // popup: Esc closes it, and the page behind does not scroll
  useEffect(() => {
    if (!alertInfo) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAlertInfo(null);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [alertInfo]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === "active" && u.status !== "active") return false;
      if (filter === "blocked" && u.status !== "blocked") return false;
      return (
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.includes(q)
      );
    });
  }, [users, search, filter]);

  const counts = {
    all: users.length,
    active: users.filter((u) => u.status === "active").length,
    blocked: users.filter((u) => u.status === "blocked").length,
  };

  const toggleBlock = async (u: UserProfile) => {
    const blocking = u.status === "active";
    const ok = await confirm({
      title: blocking ? `Block ${u.name}?` : `Unblock ${u.name}?`,
      message: blocking
        ? "They will not be able to sign in until you unblock them."
        : "They will be able to sign in again.",
      confirmLabel: blocking ? "Block user" : "Unblock user",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    setBusyId(u.id);
    try {
      await setUserBlocked(u.id, blocking);
      setUsers((list) =>
        list.map((x) =>
          x.id === u.id ? { ...x, status: blocking ? "blocked" : "active" } : x
        )
      );
    } catch (e) {
      setAlertInfo({
        title: blocking ? "Could not block the user" : "Could not unblock the user",
        message: getErrorMessage(e),
      });
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "blocked", label: "Blocked" },
  ];

  const statusBadge = (u: UserProfile) => (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
        u.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      }`}
    >
      {u.status === "active" ? "Active" : "Blocked"}
    </span>
  );

  const adminBadge = (
    <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
      Admin
    </span>
  );

  const blockBtnCls = (u: UserProfile) =>
    `rounded-lg px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50 md:py-1.5 md:text-xs ${
      u.status === "active"
        ? "text-red-600 ring-1 ring-red-200 hover:bg-red-50 active:bg-red-100"
        : "text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 active:bg-emerald-100"
    }`;

  const blockLabel = (u: UserProfile) =>
    busyId === u.id ? "Saving…" : u.status === "active" ? "Block" : "Unblock";

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Users
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          View customers and block or unblock accounts.
        </p>
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {/* toolbar: tabs and search each take a full row on phones */}
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
          <div className="flex w-full gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                aria-pressed={filter === t.key}
                className={`flex-1 rounded-lg px-3.5 py-2 text-sm font-medium transition sm:flex-none sm:py-1.5 ${
                  filter === t.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
                <span className="ml-1.5 text-xs text-slate-400">{counts[t.key]}</span>
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or phone"
              aria-label="Search users"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-base text-slate-900 placeholder:text-slate-400 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 sm:h-10 sm:text-sm"
            />
          </div>
        </div>

        {/* loading */}
        {loading && (
          <div className="animate-pulse space-y-3 border-t border-slate-100 p-3 sm:p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-slate-100 md:h-10" />
            ))}
          </div>
        )}

        {/* empty or failed */}
        {!loading && visible.length === 0 && (
          <p className="border-t border-slate-100 px-5 py-12 text-center text-sm text-slate-500">
            {loadFailed ? (
              <>
                Users could not be loaded.{" "}
                <button
                  className="font-medium text-emerald-700 underline"
                  onClick={() => {
                    setLoading(true);
                    void load();
                  }}
                >
                  Try again
                </button>
              </>
            ) : (
              "No users found."
            )}
          </p>
        )}

        {/* phones: one card per user, no sideways scrolling */}
        {!loading && visible.length > 0 && (
          <ul className="divide-y divide-slate-100 border-t border-slate-100 md:hidden">
            {visible.map((u) => (
              <li key={u.id} className="p-3.5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">
                    {initials(u)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">
                      {u.name}
                      {u.isAdmin && adminBadge}
                    </p>
                    <p className="truncate text-xs text-slate-500">{u.email}</p>
                    {u.phone ? (
                      <a href={`tel:${u.phone}`} className="inline-block py-0.5 text-xs text-emerald-700 hover:underline">
                        {u.phone}
                      </a>
                    ) : (
                      <p className="text-xs text-slate-400">No phone</p>
                    )}
                    <p className="text-xs text-slate-400">Joined {joined(u)}</p>
                  </div>
                  {statusBadge(u)}
                </div>

                {!u.isAdmin && (
                  <button
                    onClick={() => toggleBlock(u)}
                    disabled={busyId === u.id}
                    className={`mt-3 w-full ${blockBtnCls(u)}`}
                  >
                    {blockLabel(u)}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* tablet and desktop: table */}
        {!loading && visible.length > 0 && (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60">
                    <td className="max-w-[16rem] px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">
                          {initials(u)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {u.name}
                            {u.isAdmin && adminBadge}
                          </p>
                          <p className="truncate text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{u.phone || "—"}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{joined(u)}</td>
                    <td className="whitespace-nowrap px-5 py-3">{statusBadge(u)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      {u.isAdmin ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <button
                          onClick={() => toggleBlock(u)}
                          disabled={busyId === u.id}
                          className={blockBtnCls(u)}
                        >
                          {blockLabel(u)}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* errors */}
      {alertInfo && <AlertModal info={alertInfo} onClose={() => setAlertInfo(null)} />}

      {/* block / unblock confirmation */}
      {confirmElement}
    </div>
  );
}