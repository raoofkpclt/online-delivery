import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "../config/firbase/firebase";
import { AppError, getUserProfile } from "./authService";
import type { UserProfile } from "../utils/types";

/**
 * Admin login:
 * 1. sign in with Firebase Auth
 * 2. read users/{uid}
 * 3. allow only if isAdmin === true (otherwise sign out + throw)
 */
export async function adminLogin(
  email: string,
  password: string,
): Promise<UserProfile> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const profile = await getUserProfile(cred.user.uid);

  if (!profile || profile.isAdmin !== true) {
    await signOut(auth);
    throw new AppError("This account does not have admin access.");
  }
  if (profile.status === "blocked") {
    await signOut(auth);
    throw new AppError("This account has been blocked.");
  }
  return profile;
}

export const adminLogout = () => signOut(auth);

/**
 * Watches the signed-in user. Calls back with the admin profile,
 * or null when nobody is signed in / the user is not an admin.
 * Returns an unsubscribe function.
 */
export function watchAdmin(callback: (admin: UserProfile | null) => void) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return callback(null);
    try {
      const profile = await getUserProfile(user.uid);
      callback(profile?.isAdmin === true ? profile : null);
    } catch {
      callback(null);
    }
  });
}
