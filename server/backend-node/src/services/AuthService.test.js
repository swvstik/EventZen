import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from './AuthService.js';

const authService = Object.create(AuthService.prototype);

test('AuthService validates strong password', () => {
  assert.doesNotThrow(() => authService._validatePassword('StrongP@ss1'));
});

test('AuthService rejects weak password', () => {
  assert.throws(() => authService._validatePassword('weakpass'), (err) => {
    assert.equal(err.statusCode, 400);
    assert.match(err.message, /Password must be at least 8 characters/i);
    return true;
  });
});

test('AuthService allows missing phone number', () => {
  assert.doesNotThrow(() => authService._validatePhoneNumber(undefined));
});

test('AuthService validates phone number with country code and 10-digit local number', () => {
  assert.doesNotThrow(() => authService._validatePhoneNumber('+911234567890'));
});

test('AuthService rejects invalid phone number format', () => {
  assert.throws(() => authService._validatePhoneNumber('1234567890'), (err) => {
    assert.equal(err.statusCode, 400);
    assert.match(err.message, /Phone number must include country code/i);
    return true;
  });
});

test('AuthService refreshToken returns user in payload', async () => {
  const service = Object.create(AuthService.prototype);
  service.tokenService = {
    findAndDeleteRefreshToken: async () => 'user-1',
    signAccessToken: () => 'access-1',
    createRefreshToken: async () => 'refresh-2',
  };
  service.userRepo = {
    findById: async () => ({ _id: 'user-1', email: 'admin@ez.local', role: 'ADMIN' }),
  };

  const result = await service.refreshToken({ refreshToken: 'refresh-1' });

  assert.equal(result.accessToken, 'access-1');
  assert.equal(result.refreshToken, 'refresh-2');
  assert.ok(result.user);
  assert.equal(result.user.email, 'admin@ez.local');
  assert.equal(result.user.role, 'ADMIN');
});

test('AuthService updateMe blocks changing email to different value', async () => {
  const service = Object.create(AuthService.prototype);
  service.userRepo = {
    findById: async () => ({ _id: 'user-1', email: 'admin@ez.local', role: 'ADMIN' }),
    updateById: async () => ({ _id: 'user-1', email: 'admin@ez.local', role: 'ADMIN' }),
  };

  await assert.rejects(
    service.updateMe('user-1', { email: 'hijacked@ez.local' }),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /Email changes are disabled/i);
      return true;
    }
  );
});

test('AuthService requestEmailChange sends OTP for new unique email', async () => {
  const service = Object.create(AuthService.prototype);
  service.userRepo = {
    findById: async () => ({ _id: 'user-1', email: 'admin@ez.local' }),
    findByEmail: async () => null,
  };
  service.otpService = {
    generateAndSave: async () => true,
  };

  const result = await service.requestEmailChange('user-1', { newEmail: 'owner@ez.local' });

  assert.equal(result.pendingEmail, 'owner@ez.local');
  assert.match(result.message, /Verification code sent/i);
});

test('AuthService requestEmailChange rejects already-used email', async () => {
  const service = Object.create(AuthService.prototype);
  service.userRepo = {
    findById: async () => ({ _id: 'user-1', email: 'admin@ez.local' }),
    findByEmail: async () => ({ _id: 'user-2', email: 'owner@ez.local' }),
  };
  service.otpService = {
    generateAndSave: async () => true,
  };

  await assert.rejects(
    service.requestEmailChange('user-1', { newEmail: 'owner@ez.local' }),
    (err) => {
      assert.equal(err.statusCode, 409);
      return true;
    }
  );
});

test('AuthService confirmEmailChange verifies OTP and updates email', async () => {
  const service = Object.create(AuthService.prototype);
  service.userRepo = {
    findById: async () => ({ _id: 'user-1', email: 'admin@ez.local' }),
    findByEmail: async () => null,
    updateById: async () => ({ _id: 'user-1', email: 'owner@ez.local', isEmailVerified: true }),
  };
  service.otpService = {
    verify: async () => true,
  };
  service.tokenService = {
    deleteAllRefreshTokensForUser: async () => true,
  };

  const result = await service.confirmEmailChange('user-1', {
    newEmail: 'owner@ez.local',
    otp: '123456',
  });

  assert.equal(result.email, 'owner@ez.local');
  assert.equal(result.isEmailVerified, true);
});
