import { useEffect } from 'react';

export const TYPES = { single: 'Tek seçim', multi: 'Çoklu seçim', rating: 'Puan', ranked: 'Sıralı seçim' };

export async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { ...(body && { 'content-type': 'application/json' }), ...(token && { 'x-token': token }) },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401 && path.startsWith('/admin') && path !== '/admin/login') {
      window.location.assign('/admin/login');
    }
    const e = new Error((await res.json().catch(() => ({}))).error || 'Bir şeyler ters gitti. Tekrar dene.');
    e.status = res.status;
    throw e;
  }
  return res.status === 204 ? null : res.json();
}

// SSE sinyali (ve her yeniden bağlanma) gelince `load` çağrılır; `load` yalnız deps değişince yenilenir.
export function useLive(url, load, deps) {
  useEffect(() => {
    load();
    const es = new EventSource(url);
    es.onmessage = () => load();
    es.onopen = () => load();
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);
}

export const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* özel pencere: oturum yalnız bu sayfada yaşar */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* aynı */ } },
};
