// Compatibility hook backed by the app-wide Supabase auth provider.
import { useAuthContext } from "@/context/AuthContext";

export function useAuth() {
  const { user, loading } = useAuthContext();
  return { user, loading };
}
