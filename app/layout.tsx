import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import Preloader from '@/app/components/Preloader';
import { ClerkProvider } from '@clerk/nextjs';
import { ReactQueryProvider } from '@/app/components/ReactQueryProvider';
import CookieConsentBanner from '@/app/components/CookieConsentBanner';

export const metadata: Metadata = {
  title: 'aurasutra',
  description: "India's trusted practitioner directory — discover and book verified doctors, therapists, and wellness experts",
  keywords: ['directory', 'practitioners', 'wellness', 'book consultation', 'doctor'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Noto+Sans+Devanagari:wght@100..900&display=swap"
          rel="stylesheet"
        />
        <script src="https://checkout.razorpay.com/v1/checkout.js" async />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#166534" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="aurasutra" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body style={{ fontFamily: "'DM Sans', 'Noto Sans Devanagari', system-ui, sans-serif" }}>
        <ClerkProvider appearance={{
          variables: { 
            colorPrimary: '#22854a',
            colorBackground: '#ffffff',
            colorText: '#0a2e1a',
            colorInputBackground: '#ffffff',
            colorInputText: '#0a2e1a',
            colorTextOnPrimaryBackground: '#ffffff',
            borderRadius: '1rem',
            fontFamily: "'DM Sans', sans-serif"
          },
          elements: {
            card: {
              boxShadow: '0 20px 40px -10px rgba(34,133,74,0.15)',
              border: '1px solid #e4f5ec',
              borderRadius: '2rem',
              padding: '2rem'
            },
            headerTitle: {
              fontFamily: "'DM Serif Display', serif",
              fontSize: '1.75rem',
              color: '#0a2e1a'
            },
            headerSubtitle: {
              color: '#2ea05a'
            },
            formButtonPrimary: {
              backgroundColor: '#22854a',
              boxShadow: '0 4px 14px 0 rgba(34, 133, 74, 0.39)'
            },
            socialButtonsBlockButton: {
              border: '1px solid #c6ebd6',
              color: '#16522e',
              backgroundColor: '#ffffff'
            },
            formFieldInput: {
              borderColor: '#c6ebd6',
              backgroundColor: '#ffffff'
            },
            formFieldLabel: {
              color: '#0a2e1a',
              fontWeight: '600'
            },
            footerActionLink: {
              color: '#22854a',
              fontWeight: '600'
            },
            dividerLine: {
              backgroundColor: '#e4f5ec'
            },
            dividerText: {
              color: '#2ea05a'
            },
            modalBackdrop: {
              backgroundColor: 'rgba(242, 250, 245, 0.7)',
              backdropFilter: 'blur(8px)'
            }
          }
        }}>
          <LanguageProvider>
            <ReactQueryProvider>
            <Preloader />
            {children}
            <CookieConsentBanner />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#ffffff',
                  color: '#0a2e1a',
                  boxShadow: '0 12px 36px rgba(10,46,26,0.14)',
                  borderRadius: '0.875rem',
                  padding: '1rem 1.25rem',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  border: '1px solid #e4f5ec',
                },
                success: {
                  iconTheme: { primary: '#22854a', secondary: '#fff' },
                },
                error: {
                  iconTheme: { primary: '#b91c1c', secondary: '#fff' },
                },
              }}
            />
            </ReactQueryProvider>
          </LanguageProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
