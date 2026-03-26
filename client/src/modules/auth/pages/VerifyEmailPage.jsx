import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { authApi } from '@/shared/api';
import useAuthStore from '@/shared/store/authStore';
import { parseAuthPayload } from '@/shared/utils/auth';

export default function VerifyEmailPage() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const email = location.state?.email || '';

  useEffect(() => {
    if (!email) {
      navigate('/register', { replace: true });
      return;
    }
    inputRefs.current[0]?.focus();
  }, [email, navigate]);

  const handleChange = (i, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[i] = value.slice(-1);
    setOtp(newOtp);
    if (value && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    pasted.split('').forEach((ch, i) => { newOtp[i] = ch; });
    setOtp(newOtp);
    const nextEmpty = newOtp.findIndex((c) => !c);
    inputRefs.current[nextEmpty >= 0 ? nextEmpty : 5]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) return toast.error('Enter all 6 digits');
    setLoading(true);
    try {
      const res = await authApi.verifyEmail({ email, otp: code });
      const auth = parseAuthPayload(res.data);
      if (!auth.user || !auth.accessToken) {
        throw new Error('Invalid verify-email response');
      }

      setAuth(auth.user, auth.accessToken, auth.refreshToken);
      toast.success('Email verified!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await authApi.resendOtp({ email });
      toast.success('New OTP sent!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend');
    }
  };

  return (
    <div className="neo-card bg-neo-white p-8">
      <div className="text-center mb-8">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-16 h-16 bg-neo-green border-3 border-neo-black shadow-neo
                     flex items-center justify-center font-heading text-2xl mx-auto mb-4"
        >
          ✉
        </motion.div>
        <h1 className="font-heading text-2xl uppercase tracking-wider">Verify Email</h1>
        <p className="font-body text-sm text-neo-black/65 mt-1">
          Enter the 6-digit code sent to <strong>{email}</strong>
        </p>
      </div>

      <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
        {otp.map((digit, i) => (
          <motion.input
            key={i}
            ref={(el) => (inputRefs.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            whileFocus={{ scale: 1.1, boxShadow: '4px 4px 0px #FFD600' }}
            className="w-12 h-14 text-center text-xl font-heading
                       border-3 border-neo-black shadow-neo-sm
                       focus:outline-none focus:shadow-neo transition-all"
          />
        ))}
      </div>

      <button
        onClick={handleVerify}
        disabled={loading}
        className="w-full neo-btn-primary neo-btn-lg disabled:opacity-50 mb-4"
      >
        {loading ? 'Verifying...' : 'Verify'}
      </button>

      <p className="text-center font-body text-sm text-neo-black/65">
        Didn't receive code?{' '}
        <button onClick={handleResend} className="neo-link font-bold">
          Resend
        </button>
      </p>
    </div>
  );
}
