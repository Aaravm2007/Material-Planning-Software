export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const returnUrl = encodeURIComponent(window.location.href);
  window.location.href = `${API}/cdn-cgi/access/login?redirect_url=${returnUrl}`;
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...options, credentials: "include" });
  if (res.status === 401 || res.status === 403) redirectToLogin();
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
