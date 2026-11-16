import {
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  linkWithPhoneNumber,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  updatePassword,
  updateProfile,
  type ConfirmationResult,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../config/firbase/firebase";
import type { UserProfile } from "../utils/types";

/** Errors we throw ourselves (already user-friendly). */
export class AppError extends Error {}

/** Turns any error into a message safe to show in the UI. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;

  const code = (err as { code?: string })?.code ?? "";
  console.error("[auth/firestore error]", code, err);
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "No connection. Check your internet and try again.";
    case "auth/invalid-verification-code":
      return "Incorrect OTP. Try again.";
    case "auth/code-expired":
    case "auth/session-expired":
      return "OTP expired. Request a new one.";
    case "auth/invalid-phone-number":
      return "Enter a valid phone number.";
    case "auth/credential-already-in-use":
    case "auth/account-exists-with-different-credential":
    case "auth/provider-already-linked":
      return "This phone number is already registered.";
    case "auth/quota-exceeded":
      return "SMS limit reached. Try again later.";
    case "auth/captcha-check-failed":
      return "Verification failed. Refresh the page and try again.";
    case "auth/requires-recent-login":
      return "Please sign in again and retry.";
    case "permission-denied":
      return "You do not have permission to do this.";
    default:
      return "Something went wrong. Try again.";
  }
}

/* ───────── Helpers ───────── */

/** Converts a 10-digit Indian number to +91XXXXXXXXXX; other numbers need a country code. */
export function toE164(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

export const isValidPhone = (raw: string) => /^\+\d{10,15}$/.test(toE164(raw));

let verifier: RecaptchaVerifier | null = null;
let verifierEl: HTMLDivElement | null = null;

/**
 * Each verifier gets its own fresh <div> inside #recaptcha-container.
 * Reusing one element causes "reCAPTCHA has already been rendered in this element".
 */
function getVerifier() {
  if (!verifier) {
    const host = document.getElementById("recaptcha-container") ?? document.body;
    verifierEl = document.createElement("div");
    host.appendChild(verifierEl);
    verifier = new RecaptchaVerifier(auth, verifierEl, { size: "invisible" });
  }
  return verifier;
}

/** Call after any failure / before a resend so the next OTP request gets a fresh reCAPTCHA. */
export function resetVerifier() {
  try {
    verifier?.clear();
  } catch {
    /* ignore */
  }
  verifierEl?.remove();
  const host = document.getElementById("recaptcha-container");
  if (host) host.innerHTML = "";
  verifier = null;
  verifierEl = null;
}

/** Reads users/{uid} from Firestore. */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as UserProfile)
    : null;
}

/** Shared check after any sign-in: profile must exist and not be blocked. */
async function ensureProfile(uid: string): Promise<UserProfile> {
  const profile = await getUserProfile(uid);

  if (!profile) {
    const user = auth.currentUser;
    // A phone number that was never registered creates an empty phone-only
    // account. Remove it so it doesn't pile up in Authentication.
    const phoneOnly =
      user && !user.providerData.some((p) => p.providerId === "password");
    if (user && phoneOnly) {
      await user.delete().catch(() => undefined);
    }
    await signOut(auth).catch(() => undefined);
    throw new AppError("No account found. Please register first.");
  }
  if (profile.status === "blocked") {
    await signOut(auth);
    throw new AppError("This account has been blocked.");
  }
  return profile;
}

/* ───────── Email + password login ───────── */

export async function loginUser(
  email: string,
  password: string,
): Promise<UserProfile> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return ensureProfile(cred.user.uid);
}

/* ───────── Mobile OTP login ───────── */

export const sendLoginOtp = (phone: string) =>
  signInWithPhoneNumber(auth, toE164(phone), getVerifier());

export async function verifyLoginOtp(
  confirmation: ConfirmationResult,
  code: string,
): Promise<UserProfile> {
  const cred = await confirmation.confirm(code.trim());
  return ensureProfile(cred.user.uid);
}

/* ───────── Registration (email account + verified phone) ───────── */

export type RegisterInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

/** Step 1: create the email account and send an OTP to link the phone. */
export async function startRegistration(
  input: RegisterInput,
): Promise<ConfirmationResult> {
  const cred = await createUserWithEmailAndPassword(
    auth,
    input.email.trim(),
    input.password,
  );
  try {
    await updateProfile(cred.user, { displayName: input.name.trim() });
    return await linkWithPhoneNumber(
      cred.user,
      toE164(input.phone),
      getVerifier(),
    );
  } catch (err) {
    // Don't leave a half-created account behind.
    await cred.user.delete().catch(() => undefined);
    throw err;
  }
}

/** Resend the registration OTP (user is already signed in from step 1). */
export async function resendRegistrationOtp(
  phone: string,
): Promise<ConfirmationResult> {
  const user = auth.currentUser;
  if (!user) throw new AppError("Session expired. Start registration again.");
  return linkWithPhoneNumber(user, toE164(phone), getVerifier());
}

/** User tapped "Change details": remove the unfinished account. */
export async function cancelRegistration() {
  const user = auth.currentUser;
  if (user) await user.delete().catch(() => signOut(auth));
}

/** Step 2: verify OTP (links the phone) and create the Firestore profile. */
export async function finishRegistration(
  confirmation: ConfirmationResult,
  code: string,
  input: RegisterInput,
): Promise<UserProfile> {
  const cred = await confirmation.confirm(code.trim());
  await setDoc(doc(db, "users", cred.user.uid), {
    name: input.name.trim(),
    email: input.email.trim(),
    phone: toE164(input.phone),
    isAdmin: false,
    status: "active",
    createdAt: serverTimestamp(),
  });
  return (await getUserProfile(cred.user.uid)) as UserProfile;
}

/* ───────── Forgot password ───────── */

/** By email: sends Firebase's reset link. */
export const resetPassword = (email: string) =>
  sendPasswordResetEmail(auth, email.trim());

/** By mobile: step 1, send OTP. */
export const sendResetOtp = sendLoginOtp;

/** By mobile: step 2, verify OTP, set the new password, stay signed in. */
export async function finishPhoneReset(
  confirmation: ConfirmationResult,
  code: string,
  newPassword: string,
): Promise<UserProfile> {
  const cred = await confirmation.confirm(code.trim());
  const profile = await ensureProfile(cred.user.uid);
  await updatePassword(cred.user, newPassword);
  return profile;
}

export const logoutUser = () => signOut(auth);

// // import {
// //   createUserWithEmailAndPassword,
// //   sendPasswordResetEmail,
// //   signInWithEmailAndPassword,
// //   signOut,
// //   updateProfile,
// // } from "firebase/auth";
// // import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
// // import { auth, db } from "../config/firbase/firebase";
// // import type { UserProfile } from "../utils/types";

// // /** Errors we throw ourselves (already user-friendly). */
// // export class AppError extends Error {}

// // /** Turns any error into a message safe to show in the UI. */
// // export function getErrorMessage(err: unknown): string {
// //   if (err instanceof AppError) return err.message;

// //   const code = (err as { code?: string })?.code ?? "";
// //   console.error("[auth/firestore error]", code, err); // shows the real cause in the browser console
// //   switch (code) {
// //     case "auth/invalid-credential":
// //     case "auth/wrong-password":
// //     case "auth/user-not-found":
// //       return "Email or password is incorrect.";
// //     case "auth/invalid-email":
// //       return "Enter a valid email address.";
// //     case "auth/email-already-in-use":
// //       return "An account with this email already exists.";
// //     case "auth/weak-password":
// //       return "Password must be at least 6 characters.";
// //     case "auth/user-disabled":
// //       return "This account has been disabled.";
// //     case "auth/too-many-requests":
// //       return "Too many attempts. Wait a few minutes and try again.";
// //     case "auth/network-request-failed":
// //       return "No connection. Check your internet and try again.";
// //     case "permission-denied":
// //       return "You do not have permission to do this.";
// //     default:
// //       return "Something went wrong. Try again.";
// //   }
// // }

// // /** Reads users/{uid} from Firestore. */
// // export async function getUserProfile(uid: string): Promise<UserProfile | null> {
// //   const snap = await getDoc(doc(db, "users", uid));
// //   return snap.exists()
// //     ? ({ id: snap.id, ...snap.data() } as UserProfile)
// //     : null;
// // }

// // /** Customer registration. Always saves isAdmin: false. */
// // export async function registerUser(input: {
// //   name: string;
// //   email: string;
// //   phone: string;
// //   password: string;
// // }): Promise<UserProfile> {
// //   const cred = await createUserWithEmailAndPassword(
// //     auth,
// //     input.email.trim(),
// //     input.password,
// //   );
// //   await updateProfile(cred.user, { displayName: input.name.trim() });

// //   await setDoc(doc(db, "users", cred.user.uid), {
// //     name: input.name.trim(),
// //     email: input.email.trim(),
// //     phone: input.phone.trim(),
// //     isAdmin: false,
// //     status: "active",
// //     createdAt: serverTimestamp(),
// //   });

// //   return (await getUserProfile(cred.user.uid)) as UserProfile;
// // }

// // /** Customer login. Blocked users are signed out again. */
// // export async function loginUser(
// //   email: string,
// //   password: string,
// // ): Promise<UserProfile> {
// //   const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
// //   const profile = await getUserProfile(cred.user.uid);

// //   if (!profile) {
// //     await signOut(auth);
// //     throw new AppError("Account profile not found. Contact support.");
// //   }
// //   if (profile.status === "blocked") {
// //     await signOut(auth);
// //     throw new AppError("This account has been blocked.");
// //   }
// //   return profile;
// // }

// // export const logoutUser = () => signOut(auth);

// // export const resetPassword = (email: string) =>
// //   sendPasswordResetEmail(auth, email.trim());
// import {
//   RecaptchaVerifier,
//   createUserWithEmailAndPassword,
//   linkWithPhoneNumber,
//   sendPasswordResetEmail,
//   signInWithEmailAndPassword,
//   signInWithPhoneNumber,
//   signOut,
//   updatePassword,
//   updateProfile,
//   type ConfirmationResult,
// } from "firebase/auth";
// import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
// import { auth, db } from "../config/firbase/firebase";
// import type { UserProfile } from "../utils/types";

// /** Errors we throw ourselves (already user-friendly). */
// export class AppError extends Error {}

// /** Turns any error into a message safe to show in the UI. */
// export function getErrorMessage(err: unknown): string {
//   if (err instanceof AppError) return err.message;

//   const code = (err as { code?: string })?.code ?? "";
//   console.error("[auth/firestore error]", code, err);
//   switch (code) {
//     case "auth/invalid-credential":
//     case "auth/wrong-password":
//     case "auth/user-not-found":
//       return "Email or password is incorrect.";
//     case "auth/invalid-email":
//       return "Enter a valid email address.";
//     case "auth/email-already-in-use":
//       return "An account with this email already exists.";
//     case "auth/weak-password":
//       return "Password must be at least 6 characters.";
//     case "auth/user-disabled":
//       return "This account has been disabled.";
//     case "auth/too-many-requests":
//       return "Too many attempts. Wait a few minutes and try again.";
//     case "auth/network-request-failed":
//       return "No connection. Check your internet and try again.";
//     case "auth/invalid-verification-code":
//       return "Incorrect OTP. Try again.";
//     case "auth/code-expired":
//     case "auth/session-expired":
//       return "OTP expired. Request a new one.";
//     case "auth/invalid-phone-number":
//       return "Enter a valid phone number.";
//     case "auth/credential-already-in-use":
//     case "auth/account-exists-with-different-credential":
//     case "auth/provider-already-linked":
//       return "This phone number is already registered.";
//     case "auth/quota-exceeded":
//       return "SMS limit reached. Try again later.";
//     case "auth/captcha-check-failed":
//       return "Verification failed. Refresh the page and try again.";
//     case "auth/requires-recent-login":
//       return "Please sign in again and retry.";
//     case "permission-denied":
//       return "You do not have permission to do this.";
//     default:
//       return "Something went wrong. Try again.";
//   }
// }

// /* ───────── Helpers ───────── */

// /** Converts a 10-digit Indian number to +91XXXXXXXXXX; other numbers need a country code. */
// export function toE164(raw: string): string {
//   const trimmed = raw.trim();
//   const digits = trimmed.replace(/\D/g, "");
//   if (trimmed.startsWith("+")) return `+${digits}`;
//   if (digits.length === 10) return `+91${digits}`;
//   if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
//   return `+${digits}`;
// }

// export const isValidPhone = (raw: string) => /^\+\d{10,15}$/.test(toE164(raw));

// let verifier: RecaptchaVerifier | null = null;
// function getVerifier() {
//   if (!verifier) {
//     verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
//       size: "invisible",
//     });
//   }
//   return verifier;
// }
// /** Call after any failure so the next OTP request gets a fresh reCAPTCHA. */
// export function resetVerifier() {
//   try {
//     verifier?.clear();
//   } catch {
//     /* ignore */
//   }
//   verifier = null;
// }

// /** Reads users/{uid} from Firestore. */
// export async function getUserProfile(uid: string): Promise<UserProfile | null> {
//   const snap = await getDoc(doc(db, "users", uid));
//   return snap.exists()
//     ? ({ id: snap.id, ...snap.data() } as UserProfile)
//     : null;
// }

// /** Shared check after any sign-in: profile must exist and not be blocked. */
// async function ensureProfile(uid: string): Promise<UserProfile> {
//   const profile = await getUserProfile(uid);

//   if (!profile) {
//     const user = auth.currentUser;
//     // A phone number that was never registered creates an empty phone-only
//     // account. Remove it so it doesn't pile up in Authentication.
//     const phoneOnly =
//       user && !user.providerData.some((p) => p.providerId === "password");
//     if (user && phoneOnly) {
//       await user.delete().catch(() => undefined);
//     }
//     await signOut(auth).catch(() => undefined);
//     throw new AppError("No account found. Please register first.");
//   }
//   if (profile.status === "blocked") {
//     await signOut(auth);
//     throw new AppError("This account has been blocked.");
//   }
//   return profile;
// }

// /* ───────── Email + password login ───────── */

// export async function loginUser(
//   email: string,
//   password: string,
// ): Promise<UserProfile> {
//   const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
//   return ensureProfile(cred.user.uid);
// }

// /* ───────── Mobile OTP login ───────── */

// export const sendLoginOtp = (phone: string) =>
//   signInWithPhoneNumber(auth, toE164(phone), getVerifier());

// export async function verifyLoginOtp(
//   confirmation: ConfirmationResult,
//   code: string,
// ): Promise<UserProfile> {
//   const cred = await confirmation.confirm(code.trim());
//   return ensureProfile(cred.user.uid);
// }

// /* ───────── Registration (email account + verified phone) ───────── */

// export type RegisterInput = {
//   name: string;
//   email: string;
//   phone: string;
//   password: string;
// };

// /** Step 1: create the email account and send an OTP to link the phone. */
// export async function startRegistration(
//   input: RegisterInput,
// ): Promise<ConfirmationResult> {
//   const cred = await createUserWithEmailAndPassword(
//     auth,
//     input.email.trim(),
//     input.password,
//   );
//   try {
//     await updateProfile(cred.user, { displayName: input.name.trim() });
//     return await linkWithPhoneNumber(
//       cred.user,
//       toE164(input.phone),
//       getVerifier(),
//     );
//   } catch (err) {
//     // Don't leave a half-created account behind.
//     await cred.user.delete().catch(() => undefined);
//     throw err;
//   }
// }

// /** Resend the registration OTP (user is already signed in from step 1). */
// export async function resendRegistrationOtp(
//   phone: string,
// ): Promise<ConfirmationResult> {
//   const user = auth.currentUser;
//   if (!user) throw new AppError("Session expired. Start registration again.");
//   return linkWithPhoneNumber(user, toE164(phone), getVerifier());
// }

// /** User tapped "Change details": remove the unfinished account. */
// export async function cancelRegistration() {
//   const user = auth.currentUser;
//   if (user) await user.delete().catch(() => signOut(auth));
// }

// /** Step 2: verify OTP (links the phone) and create the Firestore profile. */
// export async function finishRegistration(
//   confirmation: ConfirmationResult,
//   code: string,
//   input: RegisterInput,
// ): Promise<UserProfile> {
//   const cred = await confirmation.confirm(code.trim());
//   await setDoc(doc(db, "users", cred.user.uid), {
//     name: input.name.trim(),
//     email: input.email.trim(),
//     phone: toE164(input.phone),
//     isAdmin: false,
//     status: "active",
//     createdAt: serverTimestamp(),
//   });
//   return (await getUserProfile(cred.user.uid)) as UserProfile;
// }

// /* ───────── Forgot password ───────── */

// /** By email: sends Firebase's reset link. */
// export const resetPassword = (email: string) =>
//   sendPasswordResetEmail(auth, email.trim());

// /** By mobile: step 1, send OTP. */
// export const sendResetOtp = sendLoginOtp;

// /** By mobile: step 2, verify OTP, set the new password, stay signed in. */
// export async function finishPhoneReset(
//   confirmation: ConfirmationResult,
//   code: string,
//   newPassword: string,
// ): Promise<UserProfile> {
//   const cred = await confirmation.confirm(code.trim());
//   const profile = await ensureProfile(cred.user.uid);
//   await updatePassword(cred.user, newPassword);
//   return profile;
// }

// export const logoutUser = () => signOut(auth);