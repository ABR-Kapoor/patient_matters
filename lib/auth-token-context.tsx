'use client';

import { createContext, useContext, ReactNode } from 'react';

interface AuthTokenContextType {
  token: string | null;
}

const AuthTokenContext = createContext<AuthTokenContextType | undefined>(undefined);

export function AuthTokenProvider({ children, token }: { children: ReactNode; token: string | null }) {
  return (
    <AuthTokenContext.Provider value={{ token }}>
      {children}
    </AuthTokenContext.Provider>
  );
}

export function useAuthToken(): string | null {
  const context = useContext(AuthTokenContext);
  if (context === undefined) {
    console.warn('useAuthToken must be used within AuthTokenProvider');
    return null;
  }
  return context.token;
}
