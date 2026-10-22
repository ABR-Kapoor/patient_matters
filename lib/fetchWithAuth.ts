export async function fetchWithAuth(
  url: string,
  token: string | null,
  options?: RequestInit
): Promise<Response> {
  const headers = new Headers(options?.headers);

  if (token && !token.startsWith('user_')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
