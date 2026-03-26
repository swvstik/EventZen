import { create } from 'zustand';

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: (user, accessToken) => {
    set({
      user,
      accessToken,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  updateUser: (userData) => {
    set((state) => ({
      user: { ...state.user, ...userData },
    }));
  },

  logout: () => {
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  shouldAttemptSessionRestore: () => true,

  setLoading: (isLoading) => set({ isLoading }),

  hasRole: (...roles) => {
    const { user } = get();
    return user && roles.includes(user.role);
  },

  isVendorOrAdmin: () => {
    const { user } = get();
    return user && ['VENDOR', 'ADMIN'].includes(user.role);
  },

  isAdmin: () => {
    const { user } = get();
    return user && user.role === 'ADMIN';
  },
}));

export default useAuthStore;
