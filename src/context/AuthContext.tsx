import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { DEMO_USERS } from '../data/demoData';
import { getSupabaseConfigStatus, SupabaseConfigStatus } from '../lib/supabase';

interface AuthContextType {
  currentUser: UserProfile;
  activeRole: UserRole;
  switchRole: (role: UserRole) => void;
  supabaseStatus: SupabaseConfigStatus;
  availableUsers: UserProfile[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEMO_USERS[0]); // Default to Customer
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseConfigStatus>(getSupabaseConfigStatus());

  useEffect(() => {
    setSupabaseStatus(getSupabaseConfigStatus());
  }, []);

  const switchRole = (role: UserRole) => {
    const matchedUser = DEMO_USERS.find((u) => u.role === role) || {
      id: `usr-${role}-custom`,
      email: `${role}@decizy.local`,
      fullName: `${role.toUpperCase()} User`,
      role,
      city: 'Bengaluru',
      created_at: new Date().toISOString(),
    };
    setCurrentUser(matchedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        activeRole: currentUser.role,
        switchRole,
        supabaseStatus,
        availableUsers: DEMO_USERS,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
