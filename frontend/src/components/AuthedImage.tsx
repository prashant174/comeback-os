import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/** <img> for private API files: fetches with the bearer token and shows an object URL. */
export function AuthedImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    api.get(src.replace(/^\/api/, ''), { responseType: 'blob' })
      .then((r) => { if (revoked) return; objectUrl = URL.createObjectURL(r.data as Blob); setUrl(objectUrl); })
      .catch(() => setFailed(true));
    return () => { revoked = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);
  if (failed) return <div className={cn('bg-sunken grid place-items-center text-xs text-muted', className)}>Image unavailable</div>;
  if (!url) return <div className={cn('bg-sunken animate-pulse', className)} aria-hidden />;
  return <img src={url} alt={alt} className={className} />;
}
