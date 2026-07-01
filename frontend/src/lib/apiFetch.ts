export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function notifySessionExpired() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("session-expired"));
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...options, credentials: "include" });
  if (res.status === 401 || res.status === 403) notifySessionExpired();
  return res;
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
