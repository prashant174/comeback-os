import { api } from './api';

export type ListMeta = { page: number; limit: number; total: number };
export type Params = Record<string, string | number | boolean | undefined>;

/** Typed client for a generic CRUD resource on the API (see backend utils/crud.ts). */
export function resource<T>(path: string) {
  return {
    list: (params: Params = {}) => api.get(path, { params }).then((r) => ({ items: r.data.data as T[], meta: r.data.meta as ListMeta })),
    get: (id: string) => api.get(`${path}/${id}`).then((r) => r.data.data as T),
    create: (body: Partial<T> | Record<string, unknown>) => api.post(path, body).then((r) => r.data.data as T),
    update: (id: string, body: Partial<T> | Record<string, unknown>) => api.patch(`${path}/${id}`, body).then((r) => r.data.data as T),
    remove: (id: string) => api.delete(`${path}/${id}`).then((r) => r.data.data),
  };
}

export const get = <T,>(path: string, params?: Params) => api.get(path, { params }).then((r) => r.data.data as T);
export const put = <T,>(path: string, body: unknown) => api.put(path, body).then((r) => r.data.data as T);
export const post = <T,>(path: string, body?: unknown) => api.post(path, body).then((r) => r.data.data as T);

/** Downloads a file from an authenticated endpoint (CSV export etc.). */
export async function download(path: string, params: Params, fallbackName: string) {
  const r = await api.get(path, { params, responseType: 'blob' });
  const cd = r.headers['content-disposition'] as string | undefined;
  const name = cd?.match(/filename="([^"]+)"/)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(r.data as Blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
