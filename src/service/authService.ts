import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
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
  console.error("[auth/firestore error]", code, err); // shows the real cause in the browser console
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
    case "permission-denied":
      return "You do not have permission to do this.";
    default:
      return "Something went wrong. Try again.";
  }
}

/** Reads users/{uid} from Firestore. */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as UserProfile)
    : null;
}

/** Customer registration. Always saves isAdmin: false. */
export async function registerUser(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<UserProfile> {
  const cred = await createUserWithEmailAndPassword(
    auth,
    input.email.trim(),
    input.password,
  );
  await updateProfile(cred.user, { displayName: input.name.trim() });

  await setDoc(doc(db, "users", cred.user.uid), {
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    isAdmin: false,
    status: "active",
    createdAt: serverTimestamp(),
  });

  return (await getUserProfile(cred.user.uid)) as UserProfile;
}

/** Customer login. Blocked users are signed out again. */
export async function loginUser(
  email: string,
  password: string,
): Promise<UserProfile> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const profile = await getUserProfile(cred.user.uid);

  if (!profile) {
    await signOut(auth);
    throw new AppError("Account profile not found. Contact support.");
  }
  if (profile.status === "blocked") {
    await signOut(auth);
    throw new AppError("This account has been blocked.");
  }
  return profile;
}

export const logoutUser = () => signOut(auth);

export const resetPassword = (email: string) =>
  sendPasswordResetEmail(auth, email.trim());
