import { describe, expect, it } from 'vitest';
import { getSafeRedirectPath, parseAuthPayload } from '@/shared/utils/auth';

describe('getSafeRedirectPath', () => {
  it('returns fallback for invalid or unsafe paths', () => {
    expect(getSafeRedirectPath(undefined, '/')).toBe('/');
    expect(getSafeRedirectPath('', '/')).toBe('/');
    expect(getSafeRedirectPath('http://evil.com', '/')).toBe('/');
    expect(getSafeRedirectPath('//evil.com', '/')).toBe('/');
    expect(getSafeRedirectPath('profile', '/')).toBe('/');
  });

  it('returns safe internal paths', () => {
    expect(getSafeRedirectPath('/dashboard', '/')).toBe('/dashboard');
    expect(getSafeRedirectPath('/events/1', '/')).toBe('/events/1');
  });
});

describe('parseAuthPayload', () => {
  it('parses direct payload shape', () => {
    const payload = {
      user: { id: 'u1', role: 'ADMIN' },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    };

    expect(parseAuthPayload(payload)).toEqual({
      user: payload.user,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('parses nested payload shape', () => {
    const payload = {
      data: {
        user: { id: 'u2', role: 'VENDOR' },
        accessToken: 'nested-access',
      },
    };

    expect(parseAuthPayload(payload)).toEqual({
      user: payload.data.user,
      accessToken: 'nested-access',
      refreshToken: null,
    });
  });

  it('returns null fields on invalid input', () => {
    expect(parseAuthPayload(null)).toEqual({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  });
});
