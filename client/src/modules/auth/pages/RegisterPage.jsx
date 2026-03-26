import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { authApi } from '@/shared/api';
import PhoneNumberInput from '@/shared/ui/PhoneNumberInput';
import PasswordInput from '@/shared/ui/PasswordInput';
import {
  composePhoneNumber,
  DEFAULT_PHONE_COUNTRY,
} from '@/shared/constants/phoneCountries';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  phoneCountryCode: z.string().trim().optional().refine(
    (v) => !v || /^\+\d{1,4}$/.test(v),
    'Select a valid country code'
  ),
  phoneLocalNumber: z.string().trim().optional().refine(
    (v) => !v || /^\d{6,12}$/.test(v),
    'Phone number should be 6-12 digits'
  ),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
      'Password must include uppercase, lowercase, number, and special character'
    ),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      phoneCountryCode: DEFAULT_PHONE_COUNTRY.dialCode,
      phoneLocalNumber: '',
    },
  });

  const passwordValue = watch('password', '');
  const phoneCountryCode = watch('phoneCountryCode', DEFAULT_PHONE_COUNTRY.dialCode);
  const phoneLocalNumber = watch('phoneLocalNumber', '');

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const phoneNumber = composePhoneNumber(data.phoneCountryCode, data.phoneLocalNumber);
      const payload = {
        name: data.name,
        email: data.email,
        phoneNumber: phoneNumber || undefined,
        password: data.password,
      };
      await authApi.register(payload);
      toast.success('OTP sent to your email!');
      navigate('/verify-email', { state: { email: data.email } });
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Registration failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="neo-card bg-neo-white/95 backdrop-blur-[1px] p-6 max-h-[90vh] overflow-y-auto">
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-16 h-16 bg-neo-blue border-3 border-neo-black shadow-neo
                     flex items-center justify-center font-heading text-2xl text-white mx-auto mb-4"
        >
          +
        </motion.div>
        <h1 className="font-heading text-2xl uppercase tracking-wider">Create Account</h1>
        <p className="font-body text-sm text-neo-black/70 mt-1">Join EventZen today</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="neo-label" htmlFor="register-name">Full Name</label>
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            {...register('name')}
            className="neo-input"
            placeholder="John Doe"
          />
          {errors.name && (
            <p className="font-body text-xs text-neo-red mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="neo-label" htmlFor="register-email">Email</label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            {...register('email')}
            className="neo-input"
            placeholder="you@example.com"
          />
          {errors.email && (
            <p className="font-body text-xs text-neo-red mt-1">{errors.email.message}</p>
          )}
        </div>

        <PhoneNumberInput
          label="Phone (optional)"
          countryCode={phoneCountryCode}
          localNumber={phoneLocalNumber}
          localInputId="register-phone"
          localInputName="registerPhoneDisplay"
          localAutoComplete="tel-national"
          onCountryCodeChange={(value) => setValue('phoneCountryCode', value, { shouldValidate: true })}
          onLocalNumberChange={(value) => setValue('phoneLocalNumber', value, { shouldValidate: true })}
          error={errors.phoneLocalNumber?.message || errors.phoneCountryCode?.message}
        />
        <input type="hidden" {...register('phoneCountryCode')} />
        <input type="hidden" {...register('phoneLocalNumber')} />

        <PasswordInput
          label="Password"
          id="register-password"
          autoComplete="new-password"
          registration={register('password')}
          error={errors.password?.message}
          placeholder="••••••••"
          showStrength
          passwordValue={passwordValue}
        />

        <PasswordInput
          label="Confirm Password"
          id="register-confirm-password"
          autoComplete="new-password"
          registration={register('confirmPassword')}
          error={errors.confirmPassword?.message}
          placeholder="••••••••"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full neo-btn-primary neo-btn-lg disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Sign Up'}
        </button>
      </form>

      <p className="text-center font-body text-sm text-neo-black/65 mt-4">
        Already have an account?{' '}
        <Link to="/login" className="neo-link font-bold">Sign in</Link>
      </p>
    </div>
  );
}
