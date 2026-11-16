// import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
// import { Link, useLocation, useNavigate } from "react-router-dom";
// import AuthLayout from "../../components/client/AuthLayout";
// import {
//   FormMessages,
//   PasswordField,
//   SubmitButton,
//   TextField,
//   icons,
// } from "../../components/client/AuthFields";
// import { getErrorMessage, loginUser, resetPassword } from "../../service/authService";

// export default function UserLogin() {
//   const navigate = useNavigate();
//   const location = useLocation();
//   // If a protected page sent the user here, go back to it after login.
//   const from = (location.state as { from?: string } | null)?.from ?? "/";

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [info, setInfo] = useState("");
//   const passwordRef = useRef<HTMLInputElement>(null);

//   const handleEmailKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
//     if (e.key === "Enter") {
//       e.preventDefault();
//       passwordRef.current?.focus();
//     }
//   };

//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setError("");
//     setInfo("");

//     if (!email.trim() || !password) {
//       setError("Enter your email and password.");
//       return;
//     }

//     setLoading(true);
//     try {
//       await loginUser(email, password); // signs out blocked / profile-less accounts
//       navigate(from, { replace: true });
//     } catch (err) {
//       setError(getErrorMessage(err));
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleReset = async () => {
//     setError("");
//     setInfo("");
//     if (!email.trim()) {
//       setError("Enter your email above, then select Forgot password.");
//       return;
//     }
//     try {
//       await resetPassword(email);
//       setInfo("Password reset link sent. Check your inbox.");
//     } catch (err) {
//       setError(getErrorMessage(err));
//     }
//   };

//   return (
//     <AuthLayout
//       title="Welcome back"
//       subtitle="Sign in to track your orders and checkout faster."
//       footer={
//         <>
//           New to Rahath?{" "}
//           {/* py-2 + inline-block gives a comfortable tap target on phones */}
//           <Link
//             to="/register"
//             className="inline-block py-2 font-medium text-emerald-700 hover:text-emerald-800 sm:py-0"
//           >
//             Create an account
//           </Link>
//         </>
//       }
//     >
//       {/* tighter spacing on phones, roomier from the sm breakpoint */}
//       <form onSubmit={handleSubmit} className="mt-6 space-y-4 sm:mt-8 sm:space-y-5" noValidate>
//         <TextField
//           id="email"
//           label="Email"
//           icon={icons.email}
//           type="email"
//           inputMode="email" // email keyboard with @ and .
//           autoComplete="username"
//           autoCapitalize="none" // phones must not capitalise the first letter
//           autoCorrect="off"
//           spellCheck={false}
//           enterKeyHint="next" // keyboard key shows "Next"
//           value={email}
//           onChange={(e) => setEmail(e.target.value)}
//           onKeyDown={handleEmailKeyDown}
//           placeholder="you@example.com"
//         />

//         <PasswordField
//           id="password"
//           label="Password"
//           autoComplete="current-password"
//           autoCapitalize="none"
//           autoCorrect="off"
//           spellCheck={false}
//           enterKeyHint="go" // keyboard key shows "Go" and submits the form
//           value={password}
//           onChange={(e) => setPassword(e.target.value)}
//           placeholder="Enter your password"
//           labelAction={
//             <button
//               type="button"
//               onClick={handleReset}
//               className="-my-2 px-1 py-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 focus:outline-none focus-visible:underline"
//             >
//               Forgot password?
//             </button>
//           }
//         />

//         <FormMessages error={error} info={info} />
//         <SubmitButton loading={loading} label="Sign in" loadingLabel="Signing in…" />
//       </form>
//     </AuthLayout>
//   );
// }


import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ConfirmationResult } from "firebase/auth";
import AuthLayout from "../../components/client/AuthLayout";
import {
  FormMessages,
  OtpActions,
  OtpField,
  PasswordField,
  SubmitButton,
  Tabs,
  TextField,
  icons,
} from "../../components/client/AuthFields";
import {
  getErrorMessage,
  isValidPhone,
  loginUser,
  resetVerifier,
  sendLoginOtp,
  verifyLoginOtp,
} from "../../service/authService";

type Mode = "email" | "phone";

export default function UserLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  // If a protected page sent the user here, go back to it after login.
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const switchMode = (m: Mode) => {
    setMode(m);
    setConfirmation(null);
    setOtp("");
    setError("");
    setInfo("");
  };

  const sendOtp = async () => {
    setConfirmation(await sendLoginOtp(phone));
    setOtp("");
    setInfo("OTP sent to your mobile number.");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setInfo("");

    // Validate before showing the spinner.
    if (mode === "email" && (!email.trim() || !password)) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "phone" && !confirmation && !isValidPhone(phone)) {
      setError("Enter a valid phone number.");
      return;
    }
    if (mode === "phone" && confirmation && otp.length !== 6) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "email") {
        await loginUser(email, password);
        navigate(from, { replace: true });
      } else if (!confirmation) {
        await sendOtp();
      } else {
        await verifyLoginOtp(confirmation, otp);
        navigate(from, { replace: true });
      }
    } catch (err) {
      resetVerifier();
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setInfo("");
    try {
      resetVerifier();
      await sendOtp();
    } catch (err) {
      resetVerifier();
      setError(getErrorMessage(err));
    }
  };

  const submitLabel =
    mode === "email"
      ? "Sign in"
      : confirmation
        ? "Verify & sign in"
        : "Send OTP";

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to track your orders and checkout faster."
      footer={
        <>
          New to Rahath?{" "}
          <Link
            to="/register"
            className="inline-block py-2 font-medium text-emerald-700 hover:text-emerald-800 sm:py-0"
          >
            Create an account
          </Link>
        </>
      }
    >
      <Tabs
        value={mode}
        onChange={switchMode}
        options={[
          { value: "email", label: "Email" },
          { value: "phone", label: "Mobile OTP" },
        ]}
      />

      <form onSubmit={handleSubmit} className="mt-5 space-y-4 sm:space-y-5" noValidate>
        {mode === "email" ? (
          <>
            <TextField
              id="email"
              label="Email"
              icon={icons.email}
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <PasswordField
              id="password"
              label="Password"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              labelAction={
                <Link
                  to="/forgot-password"
                  className="-my-2 px-1 py-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                >
                  Forgot password?
                </Link>
              }
            />
          </>
        ) : (
          <>
            <TextField
              id="phone"
              label="Mobile number"
              icon={icons.phone}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="go"
              disabled={!!confirmation}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98765 43210"
            />
            {confirmation && (
              <>
                <OtpField value={otp} onChange={(e) => setOtp(e.target.value)} autoFocus />
                <OtpActions
                  onResend={handleResend}
                  onChange={() => {
                    setConfirmation(null);
                    setOtp("");
                    setInfo("");
                    setError("");
                  }}
                  changeLabel="Change number"
                />
              </>
            )}
          </>
        )}

        <FormMessages error={error} info={info} />
        <SubmitButton loading={loading} label={submitLabel} loadingLabel="Please wait…" />
      </form>
    </AuthLayout>
  );
}