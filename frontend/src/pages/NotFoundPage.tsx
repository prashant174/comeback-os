import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <p className="font-display text-6xl font-semibold text-line">404</p>
      <h1 className="text-xl font-semibold mt-4">Page not found</h1>
      <p className="text-muted mt-1">The link may be mistyped. Everything lives in the sidebar.</p>
      <Button asChild className="mt-6"><Link to="/">Go to dashboard</Link></Button>
    </div>
  );
}
