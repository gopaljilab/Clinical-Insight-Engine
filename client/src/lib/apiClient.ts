/**
 * Centralized API Utility Class for Data Fetching
 * Consolidates fetch logic, error handling, credentials, and JSON parsing.
 */
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
      (error as any).status = res.status;
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

  static async get<T = any>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      ...options,
    });
    return this.handleResponse<T>(res);
  }

  static async post<T = any>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    const headers: any = data ? { "Content-Type": "application/json" } : {};
    if (options?.headers) {
      Object.assign(headers, options.headers);
    }
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      ...options,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  static async put<T = any>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    const headers: any = data ? { "Content-Type": "application/json" } : {};
    if (options?.headers) {
      Object.assign(headers, options.headers);
    }
    const res = await fetch(url, {
      method: "PUT",
      credentials: "include",
      ...options,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  static async delete<T = any>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      method: "DELETE",
      credentials: "include",
      ...options,
    });
    return this.handleResponse<T>(res);
  }
  
  static async requestRaw(url: string, options?: RequestInit): Promise<Response> {
    return fetch(url, {
      credentials: "include",
      ...options,
    });
  }
}
