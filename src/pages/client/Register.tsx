// import { useState, type FormEvent } from "react";
// import { Link, useNavigate } from "react-router-dom";
// import AuthLayout from "../../components/client/AuthLayout";
// import {
//   FormMessages,
//   PasswordField,
//   SubmitButton,
//   TextField,
//   icons,
// } from "../../components/client/AuthFields";
// import { getErrorMessage, registerUser } from "../../service/authService";

// export default function UserRegister() {
//   const navigate = useNavigate();
//   const [form, setForm] = useState({
//     name: "",
//     email: "",
//     phone: "",
//     password: "",
//     confirm: "",
//   });
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   const set =
//     (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
//       setForm((f) => ({ ...f, [key]: e.target.value }));

//   const validate = (): string => {
//     if (!form.name.trim()) return "Enter your name.";
//     if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Enter a valid email address.";
//     if (form.phone.replace(/\D/g, "").length < 10)
//       return "Enter a valid phone number (at least 10 digits).";
//     if (form.password.length < 6) return "Password must be at least 6 characters.";
//     if (form.password !== form.confirm) return "Passwords do not match.";
//     return "";
//   };

//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setError("");

//     const problem = validate();
//     if (problem) {
//       setError(problem);
//       return;
//     }

//     setLoading(true);
//     try {
//       await registerUser({
//         name: form.name,
//         email: form.email,
//         phone: form.phone,
//         password: form.password,
//       });
//       navigate("/", { replace: true });
//     } catch (err) {
//       setError(getErrorMessage(err));
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <AuthLayout
//       title="Create your account"
//       subtitle="Sign up to place orders and track deliveries."
//       footer={
//         <>
//           Already have an account?{" "}
//           {/* py-2 + inline-block gives a comfortable tap target on phones */}
//           <Link
//             to="/login"
//             className="inline-block py-2 font-medium text-emerald-700 hover:text-emerald-800 sm:py-0"
//           >
//             Sign in
//           </Link>
//         </>
//       }
//     >
//       {/* tighter spacing on phones, roomier from the sm breakpoint */}
//       <form onSubmit={handleSubmit} className="mt-6 space-y-4 sm:mt-8 sm:space-y-5" noValidate>
//         <TextField
//           id="name"
//           label="Full name"
//           icon={icons.user}
//           autoComplete="name"
//           autoCapitalize="words" // capitalises each word of the name
//           enterKeyHint="next" // keyboard key shows "Next"
//           value={form.name}
//           onChange={set("name")}
//           placeholder="Your name"
//         />
//         <TextField
//           id="email"
//           label="Email"
//           icon={icons.email}
//           type="email"
//           inputMode="email" // email keyboard with @ and .
//           autoComplete="email"
//           autoCapitalize="none" // phones must not capitalise the first letter
//           autoCorrect="off"
//           spellCheck={false}
//           enterKeyHint="next"
//           value={form.email}
//           onChange={set("email")}
//           placeholder="you@example.com"
//         />
//         <TextField
//           id="phone"
//           label="Phone"
//           icon={icons.phone}
//           type="tel"
//           autoComplete="tel"
//           inputMode="tel"
//           enterKeyHint="next"
//           value={form.phone}
//           onChange={set("phone")}
//           placeholder="+91 98765 43210"
//         />
//         <PasswordField
//           id="password"
//           label="Password"
//           autoComplete="new-password"
//           autoCapitalize="none"
//           autoCorrect="off"
//           spellCheck={false}
//           enterKeyHint="next"
//           value={form.password}
//           onChange={set("password")}
//           placeholder="At least 6 characters"
//         />
//         <PasswordField
//           id="confirm"
//           label="Confirm password"
//           autoComplete="new-password"
//           autoCapitalize="none"
//           autoCorrect="off"
//           spellCheck={false}
//           enterKeyHint="go" // keyboard key shows "Go" and submits the form
//           value={form.confirm}
//           onChange={set("confirm")}
//           placeholder="Re-enter your password"
//         />

//         <FormMessages error={error} />
//         <SubmitButton
//           loading={loading}
//           label="Create account"
//           loadingLabel="Creating account…"
//         />
//       </form>
//     </AuthLayout>
//   );
// }


import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ConfirmationResult } from "firebase/auth";
import AuthLayout from "../../components/client/AuthLayout";
import {
  FormMessages,
  OtpActions,
  OtpField,
  PasswordField,
  SubmitButton,
  TextField,
  icons,
} from "../../components/client/AuthFields";
import {
  cancelRegistration,
  finishRegistration,
  getErrorMessage,
  isValidPhone,
  resendRegistrationOtp,
  resetVerifier,
  startRegistration,
} from "../../service/authService";

export default function UserRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = (): string => {
    if (!form.name.trim()) return "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Enter a valid email address.";
    if (!isValidPhone(form.phone)) return "Enter a valid phone number.";
    if (form.password.length < 6) return "Password must be at least 6 characters.";
    if (form.password !== form.confirm) return "Passwords do not match.";
    return "";
  };

  const input = {
    name: form.name,
    email: form.email,
    phone: form.phone,
    password: form.password,
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!confirmation) {
      const problem = validate();
      if (problem) {
        setError(problem);
        return;
      }
    } else if (otp.length !== 6) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      if (!confirmation) {
        setConfirmation(await startRegistration(input)); // creates account + sends SMS
        setInfo("OTP sent to your mobile number.");
      } else {
        await finishRegistration(confirmation, otp, input);
        navigate("/", { replace: true });
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
      setConfirmation(await resendRegistrationOtp(form.phone));
      setOtp("");
      setInfo("A new OTP has been sent.");
    } catch (err) {
      resetVerifier();
      setError(getErrorMessage(err));
    }
  };

  const handleChangeDetails = async () => {
    setLoading(true);
    await cancelRegistration(); // removes the unfinished account
    resetVerifier();
    setConfirmation(null);
    setOtp("");
    setError("");
    setInfo("");
    setLoading(false);
  };

  const locked = !!confirmation;

  return (
    <AuthLayout
      title="Create your account"
      subtitle={
        locked
          ? "Enter the OTP we sent to verify your mobile number."
          : "Sign up to place orders and track deliveries."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            className="inline-block py-2 font-medium text-emerald-700 hover:text-emerald-800 sm:py-0"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="mt-6 space-y-4 sm:mt-8 sm:space-y-5" noValidate>
        <TextField
          id="name"
          label="Full name"
          icon={icons.user}
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="next"
          disabled={locked}
          value={form.name}
          onChange={set("name")}
          placeholder="Your name"
        />
        <TextField
          id="email"
          label="Email"
          icon={icons.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          disabled={locked}
          value={form.email}
          onChange={set("email")}
          placeholder="you@example.com"
        />
        <TextField
          id="phone"
          label="Mobile number"
          icon={icons.phone}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          enterKeyHint="next"
          disabled={locked}
          value={form.phone}
          onChange={set("phone")}
          placeholder="98765 43210"
        />

        {!locked && (
          <>
            <PasswordField
              id="password"
              label="Password"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              value={form.password}
              onChange={set("password")}
              placeholder="At least 6 characters"
            />
            <PasswordField
              id="confirm"
              label="Confirm password"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              value={form.confirm}
              onChange={set("confirm")}
              placeholder="Re-enter your password"
            />
          </>
        )}

        {locked && (
          <>
            <OtpField value={otp} onChange={(e) => setOtp(e.target.value)} autoFocus />
            <OtpActions
              onResend={handleResend}
              onChange={handleChangeDetails}
              changeLabel="Change details"
            />
          </>
        )}

        <FormMessages error={error} info={info} />
        <SubmitButton
          loading={loading}
          label={locked ? "Verify & create account" : "Send OTP"}
          loadingLabel={locked ? "Verifying…" : "Sending OTP…"}
        />
      </form>
    </AuthLayout>
  );
}