import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  EmailAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import Navbar from "../../components/client/Navbar";
import Footer from "../../components/client/Footer";
import { useCart } from "../../routes/client/ Cartcontext"; // ← adjust: your cart hook
import { getErrorMessage } from "../../service/authService";

/* ---------------------------------------------------------------
   Data model (same as Checkout):
   - Personal details (name, phone) live in the doc      users/{uid}
   - Delivery addresses live in the subcollection        users/{uid}/addresses/{id}
---------------------------------------------------------------- */
const USERS = "users";

type ProfileData = { name: string; phone: string };
const EMPTY: ProfileData = { name: "", phone: "" };

/** Same shape Checkout saves and reads. */
type Address = {
  id: string;
  name: string; // receiver name
  phone: string; // receiver phone
  line: string; // house / street / area
  landmark: string;
  city: string;
  pincode: string;
  isDefault: boolean;
};
type AddressForm = Omit<Address, "id" | "isDefault">;
const EMPTY_ADDR: AddressForm = { name: "", phone: "", line: "", landmark: "", city: "", pincode: "" };

const formatAddress = (a: Address) =>
  [a.line, a.landmark, a.city].filter(Boolean).join(", ") + " - " + a.pincode;

const defaultFirst = (list: Address[]) => [...list].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

type Msg = { type: "ok" | "err"; text: string };

type FieldDef<K extends string = string> = {
  key: K;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel";
  optional?: boolean;
  wide?: boolean;
};

// text-base on phones stops iPhones zooming into a field; compact again from sm up
const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:bg-slate-50 disabled:text-slate-500 sm:py-2.5 sm:text-sm";
const primaryBtn =
  "rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 active:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/40 disabled:cursor-not-allowed disabled:opacity-60 sm:py-2.5";
const ghostBtn =
  "rounded-xl border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:opacity-60 sm:py-2.5";
const linkBtn =
  "py-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 focus:outline-none focus-visible:underline disabled:opacity-60";
/** form buttons: full width and stacked on phones, side by side from sm up */
const formBtns = "flex flex-col gap-2 sm:flex-row sm:gap-3 [&>button]:w-full sm:[&>button]:w-auto";

/* ---------- validation ---------- */

const cleanPhone = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d.length === 12 && d.startsWith("91") ? d.slice(2) : d;
};

function validatePersonal(v: ProfileData) {
  if (v.name.trim().length < 2) return "Enter your full name.";
  if (!/^[6-9]\d{9}$/.test(cleanPhone(v.phone))) return "Enter a valid 10-digit mobile number.";
  return "";
}

function validateAddress(v: AddressForm) {
  if (v.name.trim().length < 2) return "Enter the receiver's name.";
  if (!/^[6-9]\d{9}$/.test(cleanPhone(v.phone))) return "Enter a valid 10-digit mobile number.";
  if (v.line.trim().length < 5) return "Enter your house number and street.";
  if (!v.city.trim()) return "Enter your town or city.";
  if (!/^\d{6}$/.test(v.pincode.trim())) return "Enter a valid 6-digit pincode.";
  return "";
}

/* ---------- small UI pieces ---------- */

function Notice({ msg }: { msg: Msg | null }) {
  if (!msg) return null;
  return (
    <p
      role={msg.type === "err" ? "alert" : "status"}
      className={`rounded-xl px-4 py-3 text-sm ring-1 ${
        msg.type === "err" ? "bg-red-50 text-red-700 ring-red-100" : "bg-emerald-50 text-emerald-800 ring-emerald-100"
      }`}
    >
      {msg.text}
    </p>
  );
}

function Card({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0 -mr-1 -mt-1">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** Personal details: shows values, switches to a form on Edit. */
function EditableSection({
  title,
  subtitle,
  fields,
  values,
  validate,
  onSave,
}: {
  title: string;
  subtitle?: string;
  fields: FieldDef<keyof ProfileData>[];
  values: ProfileData;
  validate: (v: ProfileData) => string;
  onSave: (v: ProfileData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);

  useEffect(() => {
    if (!editing) setDraft(values);
  }, [values, editing]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate(draft);
    if (problem) return setMsg({ type: "err", text: problem });
    setBusy(true);
    setMsg(null);
    try {
      await onSave({ name: draft.name.trim(), phone: cleanPhone(draft.phone) });
      setEditing(false);
      setMsg({ type: "ok", text: "Saved." });
    } catch (err) {
      setMsg({ type: "err", text: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setDraft(values);
    setMsg(null);
    setEditing(false);
  }

  return (
    <Card
      title={title}
      subtitle={subtitle}
      action={
        !editing && (
          <button
            onClick={() => {
              setMsg(null);
              setEditing(true);
            }}
            className={`${linkBtn} px-1`}
          >
            Edit<span className="sr-only"> {title.toLowerCase()}</span>
          </button>
        )
      }
    >
      {editing ? (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
                <label htmlFor={`${title}-${f.key}`} className="mb-1.5 block text-sm font-medium text-slate-700">
                  {f.label}
                  {f.optional && <span className="font-normal text-slate-400"> (optional)</span>}
                </label>
                <input
                  id={`${title}-${f.key}`}
                  value={draft[f.key]}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  autoComplete={f.autoComplete}
                  inputMode={f.inputMode}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
          <Notice msg={msg} />
          <div className={formBtns}>
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button type="button" onClick={cancel} disabled={busy} className={ghostBtn}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
                <dt className="text-xs text-slate-500">{f.label}</dt>
                <dd className={`mt-0.5 break-words text-sm ${values[f.key] ? "text-slate-900" : "text-slate-400"}`}>
                  {values[f.key] || "Not added"}
                </dd>
              </div>
            ))}
          </dl>
          {msg && (
            <div className="mt-4">
              <Notice msg={msg} />
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/* ---------- saved delivery addresses (users/{uid}/addresses) ---------- */

const ADDRESS_FIELDS: FieldDef<keyof AddressForm>[] = [
  { key: "name", label: "Receiver name", autoComplete: "name" },
  { key: "phone", label: "Mobile number", placeholder: "10-digit number", autoComplete: "tel", inputMode: "tel" },
  { key: "line", label: "House number and street", autoComplete: "street-address", wide: true },
  { key: "landmark", label: "Landmark", placeholder: "Near temple, opposite school…", optional: true, wide: true },
  { key: "city", label: "Town or city", autoComplete: "address-level2" },
  { key: "pincode", label: "Pincode", autoComplete: "postal-code", inputMode: "numeric" },
];

function Addresses({
  user,
  addresses,
  setAddresses,
  defaults,
}: {
  user: User;
  addresses: Address[];
  setAddresses: React.Dispatch<React.SetStateAction<Address[]>>;
  defaults: ProfileData;
}) {
  const col = () => collection(getFirestore(), USERS, user.uid, "addresses");

  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<AddressForm>(EMPTY_ADDR);
  const [busy, setBusy] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);

  function startAdd() {
    setMsg(null);
    setDraft({ ...EMPTY_ADDR, name: defaults.name, phone: defaults.phone });
    setEditingId("new");
  }

  function startEdit(a: Address) {
    setMsg(null);
    setDraft({ name: a.name, phone: a.phone, line: a.line, landmark: a.landmark, city: a.city, pincode: a.pincode });
    setEditingId(a.id);
  }

  function cancel() {
    setMsg(null);
    setEditingId(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateAddress(draft);
    if (problem) return setMsg({ type: "err", text: problem });

    const data: AddressForm = {
      name: draft.name.trim(),
      phone: cleanPhone(draft.phone),
      line: draft.line.trim(),
      landmark: draft.landmark.trim(),
      city: draft.city.trim(),
      pincode: draft.pincode.trim(),
    };

    setBusy(true);
    setMsg(null);
    try {
      if (editingId === "new") {
        const isDefault = addresses.length === 0;
        const ref = await addDoc(col(), { ...data, isDefault, createdAt: serverTimestamp() });
        setAddresses((prev) => defaultFirst([...prev, { id: ref.id, ...data, isDefault }]));
      } else if (editingId) {
        await updateDoc(doc(col(), editingId), data);
        setAddresses((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...data } : a)));
      }
      setEditingId(null);
      setMsg({ type: "ok", text: "Address saved." });
    } catch (err) {
      setMsg({ type: "err", text: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault(id: string) {
    setWorkingId(id);
    setMsg(null);
    try {
      const batch = writeBatch(getFirestore());
      addresses.forEach((a) => {
        const want = a.id === id;
        if (a.isDefault !== want) batch.update(doc(col(), a.id), { isDefault: want });
      });
      await batch.commit();
      setAddresses((prev) => defaultFirst(prev.map((a) => ({ ...a, isDefault: a.id === id }))));
    } catch (err) {
      setMsg({ type: "err", text: getErrorMessage(err) });
    } finally {
      setWorkingId(null);
    }
  }

  async function remove(a: Address) {
    if (!window.confirm("Delete this address?")) return;
    setWorkingId(a.id);
    setMsg(null);
    try {
      await deleteDoc(doc(col(), a.id));
      const rest = addresses.filter((x) => x.id !== a.id);
      // if the default was deleted, the next address becomes the default
      if (a.isDefault && rest.length > 0) {
        await updateDoc(doc(col(), rest[0].id), { isDefault: true });
        rest[0] = { ...rest[0], isDefault: true };
      }
      setAddresses(defaultFirst(rest));
      if (editingId === a.id) setEditingId(null);
    } catch (err) {
      setMsg({ type: "err", text: getErrorMessage(err) });
    } finally {
      setWorkingId(null);
    }
  }

  const form = (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 p-3 sm:p-4" noValidate>
      <h3 className="text-sm font-semibold text-slate-900">{editingId === "new" ? "New address" : "Edit address"}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {ADDRESS_FIELDS.map((f) => (
          <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
            <label htmlFor={`addr-${f.key}`} className="mb-1.5 block text-sm font-medium text-slate-700">
              {f.label}
              {f.optional && <span className="font-normal text-slate-400"> (optional)</span>}
            </label>
            <input
              id={`addr-${f.key}`}
              value={draft[f.key]}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              autoComplete={f.autoComplete}
              inputMode={f.inputMode}
              maxLength={f.key === "pincode" ? 6 : undefined}
              className={inputCls}
            />
          </div>
        ))}
      </div>
      {msg?.type === "err" && <Notice msg={msg} />}
      <div className={formBtns}>
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? "Saving…" : "Save address"}
        </button>
        <button type="button" onClick={cancel} disabled={busy} className={ghostBtn}>
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <Card
      title="Delivery addresses"
      subtitle="We deliver your orders to the address you pick at checkout."
      action={
        editingId === null && (
          <button onClick={startAdd} className={`${linkBtn} px-1 text-right`}>
            Add new address
          </button>
        )
      }
    >
      {addresses.length === 0 && editingId === null && (
        <p className="text-sm text-slate-500">You haven’t saved an address yet.</p>
      )}

      {addresses.length > 0 && (
        <ul className="space-y-3">
          {addresses.map((a) =>
            editingId === a.id ? (
              <li key={a.id}>{form}</li>
            ) : (
              <li key={a.id} className="rounded-xl border border-slate-200 p-3 sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-slate-900">
                      {a.name}
                      {a.isDefault && (
                        <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                          Default
                        </span>
                      )}
                    </p>
                    <p className="text-slate-600">{a.phone}</p>
                    <p className="break-words text-slate-600">{formatAddress(a)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-0 border-t border-slate-100 pt-1 sm:border-0 sm:pt-0">
                    {!a.isDefault && (
                      <button onClick={() => makeDefault(a.id)} disabled={workingId === a.id} className={linkBtn}>
                        Set as default
                      </button>
                    )}
                    <button onClick={() => startEdit(a)} disabled={workingId === a.id || editingId !== null} className={linkBtn}>
                      Edit
                    </button>
                    <button
                      onClick={() => remove(a)}
                      disabled={workingId === a.id}
                      className="py-2 text-sm font-semibold text-slate-500 hover:text-red-600 active:text-red-600 focus:outline-none focus-visible:underline disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            )
          )}
        </ul>
      )}

      {editingId === "new" && <div className={addresses.length ? "mt-3" : ""}>{form}</div>}

      {msg && !(editingId !== null && msg.type === "err") && (
        <div className="mt-4">
          <Notice msg={msg} />
        </div>
      )}
    </Card>
  );
}

/* ---------- account security ---------- */

function Security({ user }: { user: User }) {
  const hasPassword = user.providerData.some((p) => p.providerId === "password");
  const [open, setOpen] = useState<null | "email" | "password">(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const type = show ? "text" : "password";

  function toggle(which: "email" | "password") {
    setMsg(null);
    setCurrent("");
    setNext("");
    setConfirm("");
    setNewEmail("");
    setOpen(open === which ? null : which);
  }

  async function reauth() {
    if (!user.email) throw new Error("This account has no email address.");
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setMsg({ type: "err", text: "Enter a valid email address." });
    if (email === user.email?.toLowerCase()) return setMsg({ type: "err", text: "That is already your email." });
    if (!current) return setMsg({ type: "err", text: "Enter your current password." });
    setBusy(true);
    setMsg(null);
    try {
      await reauth();
      await verifyBeforeUpdateEmail(user, email);
      setOpen(null);
      setMsg({ type: "ok", text: `We sent a confirmation link to ${email}. Your email changes after you open it.` });
    } catch (err) {
      setMsg({ type: "err", text: getErrorMessage(err) });
    } finally {
      setBusy(false);
      setCurrent("");
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return setMsg({ type: "err", text: "Enter your current password." });
    if (next.length < 8) return setMsg({ type: "err", text: "New password must be at least 8 characters." });
    if (next === current) return setMsg({ type: "err", text: "Choose a password different from your current one." });
    if (next !== confirm) return setMsg({ type: "err", text: "The new passwords do not match." });
    setBusy(true);
    setMsg(null);
    try {
      await reauth();
      await updatePassword(user, next);
      setOpen(null);
      setMsg({ type: "ok", text: "Password updated." });
    } catch (err) {
      setMsg({ type: "err", text: getErrorMessage(err) });
    } finally {
      setBusy(false);
      setCurrent("");
      setNext("");
      setConfirm("");
    }
  }

  async function sendReset() {
    if (!user.email) return;
    setBusy(true);
    setMsg(null);
    try {
      await sendPasswordResetEmail(getAuth(), user.email);
      setMsg({ type: "ok", text: `Password reset link sent to ${user.email}. Check your inbox and spam folder.` });
    } catch (err) {
      setMsg({ type: "err", text: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const pwField = (id: string, label: string, value: string, set: (v: string) => void, auto: string) => (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <input id={id} type={type} value={value} onChange={(e) => set(e.target.value)} autoComplete={auto} className={inputCls} />
    </div>
  );

  const showToggle = (
    <label className="flex w-fit cursor-pointer items-center gap-2 py-1 text-sm text-slate-600">
      <input type="checkbox" checked={show} onChange={() => setShow(!show)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600/40" />
      Show passwords
    </label>
  );

  const rowBtn = "shrink-0 py-2 pl-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800";
  const resetBtn = "py-2 text-sm font-medium text-slate-600 underline hover:text-slate-900 disabled:opacity-60";

  return (
    <Card title="Login and security" subtitle="Manage your email and password.">
      {!hasPassword ? (
        <p className="text-sm text-slate-600">
          You signed in with {user.providerData[0]?.providerId ?? "another provider"}, so your email and password are managed there.
        </p>
      ) : (
        <div className="divide-y divide-slate-200">
          {/* email */}
          <div className="pb-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Email</p>
                <p className="mt-0.5 truncate text-sm text-slate-900">{user.email}</p>
              </div>
              <button onClick={() => toggle("email")} className={rowBtn}>
                {open === "email" ? "Cancel" : "Change"}
              </button>
            </div>
            {open === "email" && (
              <form onSubmit={changeEmail} className="mt-4 space-y-4" noValidate>
                <div>
                  <label htmlFor="new-email" className="mb-1.5 block text-sm font-medium text-slate-700">New email</label>
                  <input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" className={inputCls} />
                </div>
                {pwField("email-current", "Current password", current, setCurrent, "current-password")}
                {showToggle}
                <div className={formBtns}>
                  <button type="submit" disabled={busy} className={primaryBtn}>
                    {busy ? "Sending…" : "Send confirmation link"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* password */}
          <div className="pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">Password</p>
                <p className="mt-0.5 text-sm tracking-widest text-slate-900" aria-label="Hidden">••••••••</p>
              </div>
              <button onClick={() => toggle("password")} className={rowBtn}>
                {open === "password" ? "Cancel" : "Change"}
              </button>
            </div>
            {open === "password" && (
              <form onSubmit={changePassword} className="mt-4 space-y-4" noValidate>
                {pwField("pw-current", "Current password", current, setCurrent, "current-password")}
                {pwField("pw-new", "New password", next, setNext, "new-password")}
                {pwField("pw-confirm", "Confirm new password", confirm, setConfirm, "new-password")}
                {showToggle}
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
                  <button type="submit" disabled={busy} className={`${primaryBtn} w-full sm:w-auto`}>
                    {busy ? "Updating…" : "Update password"}
                  </button>
                  <button type="button" onClick={sendReset} disabled={busy} className={`${resetBtn} text-left`}>
                    Forgot it? Email me a reset link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {(msg || hasPassword) && (
        <div className="mt-5 space-y-3">
          <Notice msg={msg} />
          {open === null && hasPassword && (
            <button onClick={sendReset} disabled={busy} className={resetBtn}>
              Send a password reset link to my email
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

/* ---------- page ---------- */

const PERSONAL: FieldDef<keyof ProfileData>[] = [
  { key: "name", label: "Full name", autoComplete: "name" },
  { key: "phone", label: "Mobile number", placeholder: "10-digit number", autoComplete: "tel", inputMode: "tel" },
];

export default function Profile() {
  const { count } = useCart();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<ProfileData>(EMPTY);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const off = onAuthStateChanged(getAuth(), async (u) => {
      if (!alive) return;
      setUser(u);
      if (!u) return setReady(true);
      try {
        const fs = getFirestore();
        // profile details + saved addresses (same place Checkout reads them)
        const [snap, addrSnap] = await Promise.all([
          getDoc(doc(fs, USERS, u.uid)),
          getDocs(collection(fs, USERS, u.uid, "addresses")),
        ]);
        if (!alive) return;
        const saved = (snap.exists() ? snap.data() : {}) as Partial<ProfileData>;
        setData({
          name: saved.name || u.displayName || "",
          phone: saved.phone || "",
        });
        setAddresses(
          defaultFirst(addrSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Address, "id">) })))
        );
      } catch (e) {
        if (alive) setError(getErrorMessage(e));
      } finally {
        if (alive) setReady(true);
      }
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  async function save(patch: Partial<ProfileData>) {
    if (!user) throw new Error("Please log in again.");
    if (patch.name !== undefined && patch.name !== user.displayName) {
      await updateProfile(user, { displayName: patch.name });
    }
    await setDoc(doc(getFirestore(), USERS, user.uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
    setData((d) => ({ ...d, ...patch }));
  }

  async function logout() {
    await signOut(getAuth());
    navigate("/", { replace: true });
  }

  const initial = (data.name || user?.email || "?").charAt(0).toUpperCase();

  return (
    // extra bottom space on phones so the bottom tab bar never covers the footer
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <Navbar cartCount={count} />

      <main className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-8">
        {/* breadcrumb: tablet and desktop only */}
        <nav aria-label="Breadcrumb" className="hidden text-sm text-slate-500 sm:block">
          <Link to="/" className="hover:text-slate-800">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-800">My profile</span>
        </nav>

        {!ready ? (
          <div className="mt-2 space-y-4 sm:mt-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        ) : !user ? (
          <div className="mt-4 rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-slate-200 sm:mt-8 sm:py-14">
            <p className="text-base font-semibold text-slate-900">You are not logged in</p>
            <Link to="/login" className="mt-5 inline-block rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700">
              Log in
            </Link>
          </div>
        ) : (
          <>
            <header className="flex flex-col gap-4 sm:mt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xl font-semibold text-white" aria-hidden="true">
                  {initial}
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{data.name || "My profile"}</h1>
                  <p className="truncate text-sm text-slate-500">{user.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
                <Link to="/orders" className={ghostBtn}>My orders</Link>
                <button onClick={logout} className={ghostBtn}>Log out</button>
              </div>
            </header>

            {error && (
              <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
                {error}
              </p>
            )}

            <div className="mt-5 space-y-4 sm:mt-6 sm:space-y-5">
              <EditableSection
                title="Personal details"
                fields={PERSONAL}
                values={data}
                validate={validatePersonal}
                onSave={(v) => save({ name: v.name, phone: v.phone })}
              />
              <Addresses user={user} addresses={addresses} setAddresses={setAddresses} defaults={data} />
              <Security user={user} />
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}