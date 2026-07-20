'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { ConvexReactClient, ConvexProviderWithAuth } from 'convex/react';
import { useConvexAuthFromSupabase } from '@/utils/convex/useConvexAuthFromSupabase';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

function ConvexAuthProvider({ children }: { children: React.ReactNode }) {
  // Falls back to a plain passthrough until NEXT_PUBLIC_CONVEX_URL is set,
  // so the app keeps rendering before the Convex deployment is provisioned.
  if (!convex) return <>{children}</>;
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useConvexAuthFromSupabase}>
      {children}
    </ConvexProviderWithAuth>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <ConvexAuthProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </ConvexAuthProvider>
    </ThemeProvider>
  );
}
