// import { useState, type InputHTMLAttributes, type ReactNode } from "react";

// const inputClass =
//   "h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15";

// const Icon = ({ children }: { children: ReactNode }) => (
//   <svg
//     viewBox="0 0 24 24"
//     className="h-5 w-5"
//     fill="none"
//     stroke="currentColor"
//     strokeWidth="1.8"
//     strokeLinecap="round"
//     strokeLinejoin="round"
//     aria-hidden="true"
//   >
//     {children}
//   </svg>
// );

// export const icons = {
//   email: (
//     <Icon>
//       <rect x="3" y="5" width="18" height="14" rx="2" />
//       <path d="m3 7 9 6 9-6" />
//     </Icon>
//   ),
//   lock: (
//     <Icon>
//       <rect x="4" y="11" width="16" height="10" rx="2" />
//       <path d="M8 11V8a4 4 0 0 1 8 0v3" />
//     </Icon>
//   ),
//   user: (
//     <Icon>
//       <circle cx="12" cy="8" r="4" />
//       <path d="M4 21a8 8 0 0 1 16 0" />
//     </Icon>
//   ),
//   phone: (
//     <Icon>
//       <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
//     </Icon>
//   ),
// };

// type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
//   id: string;
//   label: string;
//   icon: ReactNode;
//   /** Optional element shown on the right of the label (e.g. "Forgot password?"). */
//   labelAction?: ReactNode;
// };

// function FieldShell({
//   id,
//   label,
//   labelAction,
//   children,
// }: {
//   id: string;
//   label: string;
//   labelAction?: ReactNode;
//   children: ReactNode;
// }) {
//   return (
//     <div>
//       <div className="mb-1.5 flex items-center justify-between">
//         <label htmlFor={id} className="block text-sm font-medium text-slate-700">
//           {label}
//         </label>
//         {labelAction}
//       </div>
//       <div className="relative">{children}</div>
//     </div>
//   );
// }

// const LeftIcon = ({ children }: { children: ReactNode }) => (
//   <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
//     {children}
//   </span>
// );

// export function TextField({ id, label, icon, labelAction, ...rest }: FieldProps) {
//   return (
//     <FieldShell id={id} label={label} labelAction={labelAction}>
//       <LeftIcon>{icon}</LeftIcon>
//       <input id={id} {...rest} className={`${inputClass} pr-4`} />
//     </FieldShell>
//   );
// }

// export function PasswordField({
//   id,
//   label,
//   labelAction,
//   ...rest
// }: Omit<FieldProps, "icon" | "type">) {
//   const [show, setShow] = useState(false);
//   return (
//     <FieldShell id={id} label={label} labelAction={labelAction}>
//       <LeftIcon>{icons.lock}</LeftIcon>
//       <input
//         id={id}
//         {...rest}
//         type={show ? "text" : "password"}
//         className={`${inputClass} pr-12`}
//       />
//       <button
//         type="button"
//         onClick={() => setShow((s) => !s)}
//         aria-label={show ? "Hide password" : "Show password"}
//         aria-pressed={show}
//         className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3.5 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:text-emerald-700"
//       >
//         {show ? (
//           <Icon>
//             <path d="M3 3l18 18" />
//             <path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-3.2 3.7M6.6 7.6A15 15 0 0 0 3 12s4 6 9 6a9.5 9.5 0 0 0 4-.9" />
//             <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
//           </Icon>
//         ) : (
//           <Icon>
//             <path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6Z" />
//             <circle cx="12" cy="12" r="3" />
//           </Icon>
//         )}
//       </button>
//     </FieldShell>
//   );
// }

// export function FormMessages({ error, info }: { error?: string; info?: string }) {
//   return (
//     <div aria-live="polite">
//       {error && (
//         <p
//           role="alert"
//           className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100"
//         >
//           {error}
//         </p>
//       )}
//       {info && (
//         <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100">
//           {info}
//         </p>
//       )}
//     </div>
//   );
// }

// export function SubmitButton({
//   loading,
//   label,
//   loadingLabel,
// }: {
//   loading: boolean;
//   label: string;
//   loadingLabel: string;
// }) {
//   return (
//     <button
//       type="submit"
//       disabled={loading}
//       className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
//     >
//       {loading && (
//         <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//           <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
//           <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
//         </svg>
//       )}
//       {loading ? loadingLabel : label}
//     </button>
//   );
// }

import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";

const inputClass =
  "h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60";

const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const icons = {
  email: (
    <Icon>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </Icon>
  ),
  lock: (
    <Icon>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Icon>
  ),
  user: (
    <Icon>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Icon>
  ),
  phone: (
    <Icon>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </Icon>
  ),
};

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon: ReactNode;
  /** Optional element shown on the right of the label (e.g. "Forgot password?"). */
  labelAction?: ReactNode;
};

function FieldShell({
  id,
  label,
  labelAction,
  children,
}: {
  id: string;
  label: string;
  labelAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

const LeftIcon = ({ children }: { children: ReactNode }) => (
  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
    {children}
  </span>
);

export function TextField({ id, label, icon, labelAction, ...rest }: FieldProps) {
  return (
    <FieldShell id={id} label={label} labelAction={labelAction}>
      <LeftIcon>{icon}</LeftIcon>
      <input id={id} {...rest} className={`${inputClass} pr-4`} />
    </FieldShell>
  );
}

export function PasswordField({
  id,
  label,
  labelAction,
  ...rest
}: Omit<FieldProps, "icon" | "type">) {
  const [show, setShow] = useState(false);
  return (
    <FieldShell id={id} label={label} labelAction={labelAction}>
      <LeftIcon>{icons.lock}</LeftIcon>
      <input
        id={id}
        {...rest}
        type={show ? "text" : "password"}
        className={`${inputClass} pr-12`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3.5 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:text-emerald-700"
      >
        {show ? (
          <Icon>
            <path d="M3 3l18 18" />
            <path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-3.2 3.7M6.6 7.6A15 15 0 0 0 3 12s4 6 9 6a9.5 9.5 0 0 0 4-.9" />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          </Icon>
        ) : (
          <Icon>
            <path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6Z" />
            <circle cx="12" cy="12" r="3" />
          </Icon>
        )}
      </button>
    </FieldShell>
  );
}

/** 6-digit code input. Only digits are kept. */
export function OtpField({
  id = "otp",
  label = "Enter OTP",
  onChange,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        {...rest}
        onChange={(e) => {
          e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
          onChange?.(e);
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        enterKeyHint="go"
        maxLength={6}
        placeholder="------"
        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 text-center text-lg font-semibold tracking-[0.6em] text-slate-900 placeholder:text-slate-300 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15"
      />
    </div>
  );
}

/** Pill-style tab switcher (Email / Mobile OTP). */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="tablist" className="mt-6 flex rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-10 flex-1 rounded-lg text-sm font-medium transition ${
            value === o.value
              ? "bg-white text-emerald-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** "Resend OTP in 30s" / "Resend OTP" plus a secondary action (e.g. Change number). */
export function OtpActions({
  onResend,
  onChange,
  changeLabel,
  seconds = 30,
}: {
  onResend: () => void;
  onChange: () => void;
  changeLabel: string;
  seconds?: number;
}) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  return (
    <div className="flex items-center justify-between text-sm">
      <button
        type="button"
        disabled={left > 0}
        onClick={() => {
          setLeft(seconds);
          onResend();
        }}
        className="py-2 font-medium text-emerald-700 hover:text-emerald-800 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        {left > 0 ? `Resend OTP in ${left}s` : "Resend OTP"}
      </button>
      <button
        type="button"
        onClick={onChange}
        className="py-2 font-medium text-slate-500 hover:text-slate-700"
      >
        {changeLabel}
      </button>
    </div>
  );
}

export function FormMessages({ error, info }: { error?: string; info?: string }) {
  return (
    <div aria-live="polite">
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100"
        >
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100">
          {info}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({
  loading,
  label,
  loadingLabel,
}: {
  loading: boolean;
  label: string;
  loadingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {loading ? loadingLabel : label}
    </button>
  );
}