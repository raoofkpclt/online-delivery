import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../routes/AuthContext";

/** Wrap routes that need a signed-in customer (checkout, orders, profile...). */
export default function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    // remember where the user was going so login / register can send them back
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
