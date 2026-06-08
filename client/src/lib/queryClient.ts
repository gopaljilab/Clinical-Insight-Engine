import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { ApiClient } from "./apiClient";

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await ApiClient.requestRaw(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T | null> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      return await ApiClient.get(queryKey.join("/") as string);
    } catch (error: any) {
      if (unauthorizedBehavior === "returnNull" && error.status === 401) {
        return null;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      // Set to 0 so assessment data is never considered "fresh" from cache.
      // This prevents stale patient records from being served when navigating
      // between patients (fix for Issue #744: Cross-Patient Data Leakage).
      staleTime: 0,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
