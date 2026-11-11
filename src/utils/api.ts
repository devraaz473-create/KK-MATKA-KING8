import { Capacitor } from '@capacitor/core';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim();

function getApiUrl(path: string): string {
  if (API_BASE_URL) {
    let base: URL;
    try {
      base = new URL(API_BASE_URL);
    } catch {
      throw new Error('VITE_API_BASE_URL must be a valid HTTPS URL.');
    }

    const isLocalhost = base.hostname === 'localhost' || base.hostname === '127.0.0.1';
    if (base.protocol !== 'https:' && !(isLocalhost && base.protocol === 'http:')) {
      throw new Error('The API server must use HTTPS.');
    }
    if (base.username || base.password || base.search || base.hash) {
      throw new Error('VITE_API_BASE_URL must contain only the server origin and optional path.');
    }

    return new URL(path, base.href.endsWith('/') ? base : `${base.href}/`).toString();
  }

  if (Capacitor.isNativePlatform()) {
    throw new Error('Android build is missing VITE_API_BASE_URL. Rebuild with the deployed HTTPS API URL.');
  }

  return path;
}

export function getApiEndpoint(path: string): string {
  return getApiUrl(path);
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(getApiUrl(path), {
    ...init,
    credentials: 'include',
    signal: init.signal || AbortSignal.timeout(10000)
  });
}

export async function readApiResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data.message === 'string'
      ? data.message
      : `Server returned HTTP ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}
