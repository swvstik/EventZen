import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { authApi } from '@/shared/api';
import useAuthStore from '@/shared/store/authStore';
import { getSafeRedirectPath, parseAuthPayload } from '@/shared/utils/auth';
import PasswordInput from '@/shared/ui/PasswordInput';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await authApi.login(data);
      const auth = parseAuthPayload(res.data);
      if (!auth.user || !auth.accessToken) {
        throw new Error('Invalid login response');
      }

      setAuth(auth.user, auth.accessToken, auth.refreshToken);
      toast.success('Welcome back!');
      const from = getSafeRedirectPath(location.state?.from?.pathname, '/');
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.response?.status === 401
        ? 'Invalid email or password.'
        : 'Login failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="neo-card bg-neo-white/95 backdrop-blur-[1px] p-8">
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-16 h-16 bg-neo-green border-3 border-neo-black shadow-neo
                     flex items-center justify-center font-heading text-2xl mx-auto mb-4"
        >
          E
        </motion.div>
        <h1 className="font-heading text-2xl uppercase tracking-wider">Welcome Back</h1>
        <p className="font-body text-sm text-neo-black/70 mt-1">Sign in to your account</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="neo-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            {...register('email')}
            className="neo-input"
            placeholder="you@example.com"
          />
          {errors.email && (
            <p className="font-body text-xs text-neo-red mt-1">{errors.email.message}</p>
          )}
        </div>

        <PasswordInput
          label="Password"
          id="login-password"
          autoComplete="current-password"
          registration={register('password')}
          error={errors.password?.message}
          placeholder="••••••••"
        />

        <div className="text-right">
          <Link to="/forgot-password" className="font-body text-xs neo-link">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full neo-btn-primary neo-btn-lg disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="text-center font-body text-sm text-neo-black/65 mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="neo-link font-bold">Sign up</Link>
      </p>
    </div>
  );
}
