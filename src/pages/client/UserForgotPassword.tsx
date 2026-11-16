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
  Tabs,
  TextField,
  icons,
} from "../../components/client/AuthFields";
import {
  finishPhoneReset,
  getErrorMessage,
  isValidPhone,
  resetPassword,
  resetVerifier,
  sendResetOtp,
} from "../../service/authService";

type Mode = "phone" | "email";

export default function UserForgotPassword() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("phone");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    setConfirmation(await sendResetOtp(phone));
    setOtp("");
    setInfo("OTP sent to your mobile number.");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setInfo("");

    // ── Validation ──
    if (mode === "email" && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (mode === "phone" && !confirmation && !isValidPhone(phone)) {
      setError("Enter a valid phone number.");
      return;
    }
    if (mode === "phone" && confirmation) {
      if (otp.length !== 6) return setError("Enter the 6-digit OTP.");
      if (newPassword.length < 6)
        return setError("Password must be at least 6 characters.");
      if (newPassword !== confirmPassword)
        return setError("Passwords do not match.");
    }

    setLoading(true);
    try {
      if (mode === "email") {
        await resetPassword(email);
        setInfo(
          "Reset link sent. Check your inbox and spam folder. It can take a few minutes.",
        );
      } else if (!confirmation) {
        await sendOtp();
      } else {
        await finishPhoneReset(confirmation, otp, newPassword);
        navigate("/", { replace: true }); // password changed and signed in
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
      ? "Send reset link"
      : confirmation
        ? "Verify & reset password"
        : "Send OTP";

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={
        mode === "phone" && confirmation
          ? "Enter the OTP and choose a new password."
          : "Choose how you want to verify it's you."
      }
      footer={
        <>
          Remembered it?{" "}
          <Link
            to="/login"
            className="inline-block py-2 font-medium text-emerald-700 hover:text-emerald-800 sm:py-0"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <Tabs
        value={mode}
        onChange={switchMode}
        options={[
          { value: "phone", label: "Mobile OTP" },
          { value: "email", label: "Email link" },
        ]}
      />

      <form onSubmit={handleSubmit} className="mt-5 space-y-4 sm:space-y-5" noValidate>
        {mode === "email" ? (
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
            enterKeyHint="go"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        ) : (
          <>
            <TextField
              id="phone"
              label="Registered mobile number"
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
                <PasswordField
                  id="new-password"
                  label="New password"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
                <PasswordField
                  id="confirm-password"
                  label="Confirm new password"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
                <OtpActions
                  onResend={handleResend}
                  onChange={() => {
                    setConfirmation(null);
                    setOtp("");
                    setError("");
                    setInfo("");
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