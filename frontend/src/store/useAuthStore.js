import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      githubToken: null,
      gitHubStatus: 'none', // 'none', 'validating', 'valid', 'invalid'
      
      login: () => set({ isAuthenticated: true, user: { name: 'Demo User' } }),
      logout: () => set({ isAuthenticated: false, user: null, githubToken: null, gitHubStatus: 'none' }),
      
      setGithubToken: (token) => set({ githubToken: token, gitHubStatus: 'none' }),
      setGitHubStatus: (status) => set({ gitHubStatus: status }),
      clearGithubToken: () => set({ githubToken: null, gitHubStatus: 'none' }),
    }),
    {
      name: 'access-scan-auth',
    }
  )
);
