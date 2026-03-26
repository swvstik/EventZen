import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { authApi } from '@/shared/api';

const schema = z.object({ email: z.string().email('Invalid email') });

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await authApi.forgotPassword(data);
      setSent(true);
      toast.success('Reset link sent!');
    } catch {
      toast.success('If the email exists, a reset link has been sent.');
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="neo-card bg-neo-white p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-neo-orange border-3 border-neo-black shadow-neo
                       flex items-center justify-center font-heading text-2xl mx-auto mb-4">
          ?
        </div>
        <h1 className="font-heading text-2xl uppercase tracking-wider">Forgot Password</h1>
        <p className="font-body text-sm text-neo-black/65 mt-1">We'll send you a reset link</p>
      </div>

      {sent ? (
        <div className="text-center p-6 bg-neo-green/10 border-3 border-neo-green">
          <p className="font-heading text-sm uppercase tracking-wider text-neo-green mb-2">Email Sent!</p>
          <p className="font-body text-sm text-neo-black/70">Check your inbox for the reset link.</p>
          <Link to="/login" className="neo-btn-primary neo-btn-sm mt-4 inline-flex">Back to Login</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="neo-label" htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className="neo-input"
              placeholder="you@example.com"
            />
            {errors.email && <p className="font-body text-xs text-neo-red mt-1">{errors.email.message}</p>}
          </div>
          <button type="submit" disabled={loading} className="w-full neo-btn-primary neo-btn-lg disabled:opacity-50">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
      )}

      <p className="text-center font-body text-sm text-neo-black/65 mt-6">
        <Link to="/login" className="neo-link">Back to login</Link>
      </p>
    </div>
  );
}
