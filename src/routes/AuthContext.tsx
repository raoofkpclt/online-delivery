import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../config/firbase/firebase";
import { getUserProfile } from "../service/authService";
import type { UserProfile } from "../utils/types";

type AuthState = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean; // true until Firebase tells us if someone is signed in
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      try {
        setProfile(u ? await getUserProfile(u.uid) : null);
      } catch {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  // Used after registration: the profile document is written just after the account is created.
  const refreshProfile = useCallback(async () => {
    const u = auth.currentUser;
    setProfile(u ? await getUserProfile(u.uid) : null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);