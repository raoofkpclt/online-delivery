// import type { ReactNode } from "react";

// /** Shared shell for the customer login / register pages (same look as the admin login). */
// export default function AuthLayout({
//   title,
//   subtitle,
//   children,
//   footer,
// }: {
//   title: string;
//   subtitle: string;
//   children: ReactNode;
//   footer?: ReactNode;
// }) {
//   return (
//     <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-6 py-12">
//       <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
//       <div className="pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-teal-400/15 blur-3xl" />

//       <div className="relative w-full max-w-md">
//         <div className="mb-8 flex flex-col items-center text-center">
//           <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
//             <svg
//               viewBox="0 0 24 24"
//               className="h-7 w-7"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="2"
//               strokeLinecap="round"
//               strokeLinejoin="round"
//               aria-hidden="true"
//             >
//               <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
//               <path d="m3 8 9 5 9-5M12 13v8" />
//             </svg>
//           </span>
//           <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
//             Rahath
//           </h1>
//         </div>

//         <div className="rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200 sm:p-10">
//           <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
//             {title}
//           </h2>
//           <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
//           {children}
//         </div>

//         {footer && (
//           <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>
//         )}
//       </div>
//     </div>
//   );
// }

import type { ReactNode } from "react";

/** Shared shell for the customer login / register / forgot-password pages. */
export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-6 py-12">
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-teal-400/15 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
              <path d="m3 8 9 5 9-5M12 13v8" />
            </svg>
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            Rahath
          </h1>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200 sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
          {children}
        </div>

        {footer && (
          <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>
        )}
      </div>

      {/* Invisible reCAPTCHA used by Firebase phone auth. Must stay in the DOM. */}
      <div id="recaptcha-container" />
    </div>
  );
}