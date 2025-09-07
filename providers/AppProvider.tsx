'use client';

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { AudioProvider } from '@/contexts/AudioContext';

type AppContextType = {
  auth: ReturnType<typeof useAuth>;
  profile: ReturnType<typeof useProfile>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  console.log('AppProvider rendered');
  const auth = useAuth();
  const profile = useProfile(auth.user);
  const value = useMemo(() => ({ auth, profile }), [auth, profile]);

  return (
    <AppContext.Provider value={value}>
      <AudioProvider>
        {children}
      </AudioProvider>
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
} 