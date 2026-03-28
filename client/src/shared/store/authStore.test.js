import { beforeEach, describe, expect, it } from 'vitest';
import useAuthStore from '@/shared/store/authStore';

const defaultState = {
  user: null,
  accessToken: null,
  isLoading: true,
  isAuthenticated: false,
};

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState(defaultState);
  });

  it('sets authentication state via setAuth', () => {
    useAuthStore.getState().setAuth({ id: 'u1', role: 'ADMIN' }, 'token-123');
    const state = useAuthStore.getState();

    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.user).toEqual({ id: 'u1', role: 'ADMIN' });
    expect(state.accessToken).toBe('token-123');
  });

  it('clears authentication state via logout', () => {
    useAuthStore.getState().setAuth({ id: 'u1', role: 'VENDOR' }, 'token-xyz');
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();

    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
  });

  it('evaluates role helpers correctly', () => {
    useAuthStore.getState().setAuth({ id: 'u1', role: 'VENDOR' }, 'token-xyz');
    const state = useAuthStore.getState();

    expect(state.hasRole('ADMIN')).toBe(false);
    expect(state.hasRole('VENDOR')).toBe(true);
    expect(state.isVendorOrAdmin()).toBe(true);
    expect(state.isAdmin()).toBe(false);
  });
});
