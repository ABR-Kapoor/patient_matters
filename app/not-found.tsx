import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center space-y-4 text-center max-w-[480px] p-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Page Not Found</h1>
        <p className="text-muted-foreground">
          The page you are looking for doesn&apos;t exist, has been removed, or is temporarily unavailable.
        </p>
        <div className="pt-4">
          <Link
            href="/"
            className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-xl shadow hover:bg-primary/90 transition-colors inline-block"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
