import { useQuery } from "@tanstack/react-query";
import { ApiClient } from "../lib/apiClient";

interface AuthUser {
  email: string;
  name: string;
  role?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth(): AuthState {
  const { data, isLoading } = useQuery<{ user: AuthUser } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        return await ApiClient.get<{ user: AuthUser }>("/api/auth/me");
      } catch (err: unknown) {
        const error = err as { status?: number };
        if (error.status === 401) {
          return null;
        }
        throw new Error("Failed to check authentication status");
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    user: data?.user ?? null,
    isLoading,
    isAuthenticated: !!data?.user,
  };
}
