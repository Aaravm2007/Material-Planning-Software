export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Tracks whether this tab has ever seen a successful authenticated response.
// If a 401/403 happens before that, there was never a valid access cookie to
// begin with, so we skip the "session expired" countdown and bounce straight
// to login instead of showing a misleading expiry message.
let hasAuthenticated = false;

export function notifySessionExpired() {
  if (typeof window === "undefined") return;
  if (!hasAuthenticated) {
    window.location.href = "/login";
    return;
  }
  window.dispatchEvent(new CustomEvent("session-expired"));
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    const res = await fetch(url, { ...options, credentials: "include" });
    if (res.status === 401 || res.status === 403) {
      notifySessionExpired();
    } else if (res.ok) {
      hasAuthenticated = true;
    }
    return res;
  } catch {
    // Network error — backend unreachable
    return new Response(JSON.stringify({ detail: "Cannot reach server" }), { status: 503 });
  }
}

export function apiGet(url: string): Promise<Response> {
  return fetch(url, {
    cache: "no-store",
    headers: {
      "CF-Access-Client-Id":     process.env.CF_ACCESS_CLIENT_ID     ?? "",
      "CF-Access-Client-Secret": process.env.CF_ACCESS_CLIENT_SECRET ?? "",
    },
  });
}
