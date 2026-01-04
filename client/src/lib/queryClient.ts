import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      const errorData = await res.json();
      // Extract just the message if it's a JSON response
      const message = errorData.message || res.statusText;
      throw new Error(message);
    } catch (parseError) {
      // If not JSON, fall back to text
      const text = await res.text() || res.statusText;
      throw new Error(text);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  console.log(`=== CLIENT apiRequest DEBUG [${method}] ${url} ===`);
  console.log("localStorage contents:", {...localStorage});
  console.log("navigator.onLine:", navigator.onLine);
  
  const authToken = localStorage.getItem("auth_token");
  const regularToken = localStorage.getItem("token");
  const token = authToken || regularToken;
  
  console.log("auth_token from localStorage:", authToken);
  console.log("token from localStorage:", regularToken);
  console.log("Final token selected:", token);
  
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    console.log("Authorization header set:", `Bearer ${token.substring(0, 20)}...`);
  } else {
    console.error("❌ NO TOKEN FOUND!");
    console.log("Available localStorage keys:", Object.keys(localStorage));
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    // If offline and it's a write operation, store for later sync
    if (!navigator.onLine && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
      try {
        // Store the request for sync when back online - ensure token is included
        const offlineRequest = {
          url,
          method,
          headers: {
            ...headers,
            // Ensure auth header is preserved even if not originally included
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: data ? JSON.stringify(data) : undefined,
          timestamp: Date.now()
        };
        
        const existingRequests = JSON.parse(localStorage.getItem('offline_requests') || '[]');
        existingRequests.push(offlineRequest);
        localStorage.setItem('offline_requests', JSON.stringify(existingRequests));
        
        // Return a synthetic response indicating offline storage
        return new Response(JSON.stringify({
          success: true,
          offline: true,
          message: 'Changes saved locally and will sync when online'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (storageError) {
        console.error('Failed to store offline request:', storageError);
      }
    }
    
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem("auth_token");
    const headers: Record<string, string> = {};
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(queryKey[0] as string, {
        headers,
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      const data = await res.json();
      
      // Cache successful responses for offline access
      try {
        localStorage.setItem(`cache_${queryKey[0]}`, JSON.stringify({
          data,
          timestamp: Date.now(),
          url: queryKey[0]
        }));
      } catch (cacheError) {
        console.warn('Failed to cache response:', cacheError);
      }
      
      return data;
    } catch (error) {
      // If offline, try to return cached data
      if (!navigator.onLine) {
        try {
          const cached = localStorage.getItem(`cache_${queryKey[0]}`);
          if (cached) {
            const cachedData = JSON.parse(cached);
            console.log('Returning cached data for:', queryKey[0]);
            return {
              ...cachedData.data,
              _fromCache: true,
              _cacheTimestamp: cachedData.timestamp
            };
          }
        } catch (cacheError) {
          console.error('Failed to retrieve cached data:', cacheError);
        }
      }
      
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        // Don't retry if offline
        if (!navigator.onLine) {
          return false;
        }
        return failureCount < 2;
      },
      // Increase cache time for offline support
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations if offline - they'll be handled by service worker
        if (!navigator.onLine) {
          return false;
        }
        return failureCount < 2;
      }
    },
  },
});
