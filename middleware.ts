import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/about(.*)',
  '/contact(.*)',
  '/vision(.*)',
  '/disclaimer(.*)',
  '/privacy-policy(.*)',
  '/terms-and-conditions(.*)',
  '/refund-policy(.*)',
  '/unauthorized(.*)',
  '/api/health(.*)',
  '/api/doctors(.*)',
  '/api/translate(.*)',
  '/api/webhooks(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  try {
    if (!isPublicRoute(req)) {
      await auth();
    }
  } catch (error) {
    console.error('Clerk middleware error:', error);
    return NextResponse.next();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
