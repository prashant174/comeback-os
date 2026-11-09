import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Free hosting puts the server to sleep when idle; the first request then
 * takes up to a minute. If any API call is pending > 4 s, explain why.
 */
export function ServerWaking() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const pending = new Map<object, number>();
    const check = () => setSlow([...pending.values()].some((t) => Date.now() - t > 4000));
    const req = api.interceptors.request.use((cfg) => { pending.set(cfg, Date.now()); return cfg; });
    const done = (cfg: object | undefined) => { if (cfg) pending.delete(cfg); check(); };
    const res = api.interceptors.response.use((r) => { done(r.config); return r; }, (e) => { done(e?.config); return Promise.reject(e); });
    const t = setInterval(check, 1000);
    return () => { api.interceptors.request.eject(req); api.interceptors.response.eject(res); clearInterval(t); };
  }, []);
  if (!slow) return null;
  return (
    <div role="status" className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] panel shadow-lg px-4 py-2.5 flex items-center gap-2 text-sm" style={{ marginTop: 'env(safe-area-inset-top)' }}>
      <Loader2 className="h-4 w-4 animate-spin text-leaf" />Waking up the server — this can take up to a minute on free hosting.
    </div>
  );
}
