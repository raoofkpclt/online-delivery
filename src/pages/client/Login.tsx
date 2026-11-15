import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../../components/client/AuthLayout";
import {
  FormMessages,
  PasswordField,
  SubmitButton,
  TextField,
  icons,
} from "../../components/client/AuthFields";
import { getErrorMessage, loginUser, resetPassword } from "../../service/authService";

export default function UserLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  // If a protected page sent the user here, go back to it after login.
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleEmailKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      passwordRef.current?.focus();
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      await loginUser(email, password); // signs out blocked / profile-less accounts
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Enter your email above, then select Forgot password.");
      return;
    }
    try {
      await resetPassword(email);
      setInfo("Password reset link sent. Check your inbox.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to track your orders and checkout faster."
      footer={
        <>
          New to Rahath?{" "}
          {/* py-2 + inline-block gives a comfortable tap target on phones */}
          <Link
            to="/register"
            className="inline-block py-2 font-medium text-emerald-700 hover:text-emerald-800 sm:py-0"
          >
            Create an account
          </Link>
        </>
      }
    >
      {/* tighter spacing on phones, roomier from the sm breakpoint */}
      <form onSubmit={handleSubmit} className="mt-6 space-y-4 sm:mt-8 sm:space-y-5" noValidate>
        <TextField
          id="email"
          label="Email"
          icon={icons.email}
          type="email"
          inputMode="email" // email keyboard with @ and .
          autoComplete="username"
          autoCapitalize="none" // phones must not capitalise the first letter
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next" // keyboard key shows "Next"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleEmailKeyDown}
          placeholder="you@example.com"
        />

        <PasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go" // keyboard key shows "Go" and submits the form
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          labelAction={
            <button
              type="button"
              onClick={handleReset}
              className="-my-2 px-1 py-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 focus:outline-none focus-visible:underline"
            >
              Forgot password?
            </button>
          }
        />

        <FormMessages error={error} info={info} />
        <SubmitButton loading={loading} label="Sign in" loadingLabel="Signing in…" />
      </form>
    </AuthLayout>
  );
}