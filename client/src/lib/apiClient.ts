/**
 * Centralized API Utility Class for Data Fetching
 * Consolidates fetch logic, error handling, credentials, and JSON parsing.
 */

/**
 * Resolves a relative API path against VITE_API_BASE when configured.
 * This ensures all ApiClient calls work correctly when the app is deployed
 * with a separate backend origin or behind a reverse proxy with a path prefix.
 * Falls back to the relative path when VITE_API_BASE is not set (local dev).
 */
function resolveUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, "") ?? "";
  return base ? `${base}${path}` : path;
}

/**  Api Client. */
export class ApiClient {
  /**
   * Helper to check the response and throw standardized errors
   */
  private static async handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      let errorMessage = res.statusText;
      try {
        const errorData = await res.json();
        errorMessage = errorData.message || errorMessage;
      } catch (err) {
        try {
          const text = await res.text();
          if (text) errorMessage = text;
        } catch (e) {
          // fallback to statusText
        }
      }
      const error = new Error(`${res.status}: ${errorMessage}`);
      (error as Error & { status: number }).status = res.status;
      throw error;
    }

    // Sometimes DELETE requests have no content
    if (res.status === 204) {
      return {} as T;
    }

    try {
      return await res.json();
    } catch (err) {
      return {} as T;
    }
  }

  /**
     * Get.
     * @param url - The url parameter.
     * @param options - The options parameter.
     * @returns The result of the operation.
     */
    static async get<T = unknown>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(resolveUrl(url), {
      method: "GET",
      credentials: "include",
      ...options,
    });
    return this.handleResponse<T>(res);
  }

  /**
     * Post.
     * @param url - The url parameter.
     * @param data - The data parameter.
     * @param options - The options parameter.
     * @returns The result of the operation.
     */
    static async post<T = unknown>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    const headers: HeadersInit = data ? { "Content-Type": "application/json" } : {};
    if (options?.headers) {
      Object.assign(headers, options.headers);
    }
    const res = await fetch(resolveUrl(url), {
      method: "POST",
      credentials: "include",
      ...options,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  /**
     * Put.
     * @param url - The url parameter.
     * @param data - The data parameter.
     * @param options - The options parameter.
     * @returns The result of the operation.
     */
    static async put<T = unknown>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    const headers: HeadersInit = data ? { "Content-Type": "application/json" } : {};
    if (options?.headers) {
      Object.assign(headers, options.headers);
    }
    const res = await fetch(resolveUrl(url), {
      method: "PUT",
      credentials: "include",
      ...options,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  /**
     * Delete.
     * @param url - The url parameter.
     * @param options - The options parameter.
     * @returns The result of the operation.
     */
    static async delete<T = unknown>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(resolveUrl(url), {
      method: "DELETE",
      credentials: "include",
      ...options,
    });
    return this.handleResponse<T>(res);
  }
  
  /**
     * Request Raw.
     * @param url - The url parameter.
     * @param options - The options parameter.
     * @returns The result of the operation.
     */
    static async requestRaw(url: string, options?: RequestInit): Promise<Response> {
    return fetch(resolveUrl(url), {
      credentials: "include",
      ...options,
    });
  }
}
