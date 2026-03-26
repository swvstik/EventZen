import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { authApi } from '@/shared/api';
import PasswordInput from '@/shared/ui/PasswordInput';

const schema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const {
    register,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });
  const newPasswordValue = watch('newPassword', '');

  const onSubmit = async (data) => {
    if (!token) return toast.error('Invalid reset link');
    setLoading(true);
    try {
      await authApi.resetPassword({ token, newPassword: data.newPassword });
      toast.success('Password reset! You can now login.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed - link may have expired');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="neo-card bg-neo-white p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-neo-purple border-3 border-neo-black shadow-neo
                       flex items-center justify-center font-heading text-2xl text-white mx-auto mb-4">
          EZ
        </div>
        <h1 className="font-heading text-2xl uppercase tracking-wider">Reset Password</h1>
        <p className="font-body text-sm text-neo-black/65 mt-1">Enter your new password</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <PasswordInput
          label="New Password"
          id="reset-new-password"
          autoComplete="new-password"
          registration={register('newPassword')}
          error={errors.newPassword?.message}
          placeholder="••••••••"
          showStrength
          passwordValue={newPasswordValue}
        />

        <PasswordInput
          label="Confirm Password"
          id="reset-confirm-password"
          autoComplete="new-password"
          registration={register('confirmPassword')}
          error={errors.confirmPassword?.message}
          placeholder="••••••••"
        />
        <button type="submit" disabled={loading} className="w-full neo-btn-primary neo-btn-lg disabled:opacity-50">
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>

      <p className="text-center font-body text-sm text-neo-black/65 mt-6">
        <Link to="/login" className="neo-link">Back to login</Link>
      </p>
    </div>
  );
}
