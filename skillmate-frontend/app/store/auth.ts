import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  role?: string; // "student" | "recruiter"
}

interface AuthState {
  // State
  user: UserProfile | null;
  credits: number;
  isAuthenticated: boolean;

  // Actions
  setUser: (user: UserProfile | null) => void;
  setCredits: (credits: number) => void;
  decrementCredits: (count?: number) => void;
  setRole: (role: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial State
      user: null,
      credits: 0, // Default to 0 until loaded from backend
      isAuthenticated: false,

      // Actions
      setUser: (user) => 
        set({ 
          user, 
          isAuthenticated: !!user 
        }),

      setCredits: (credits) => 
        set({ credits }),

      decrementCredits: (count = 1) =>
        set((state) => ({
          credits: Math.max(state.credits - count, 0),
        })),

      setRole: (role) =>
        set((state) => ({
          user: state.user ? { ...state.user, role } : null,
        })),

      logout: () => 
        set({ 
          user: null, 
          credits: 0, 
          isAuthenticated: false 
        }),
    }),
    {
      name: "skillmate-auth-storage", // Unique key for localStorage
      storage: createJSONStorage(() => localStorage), // Persist to browser storage
    }
  )
);