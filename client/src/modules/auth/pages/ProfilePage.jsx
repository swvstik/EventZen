import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HiX } from 'react-icons/hi';

import toast from 'react-hot-toast';
import { attendeesApi, authApi } from '@/shared/api';
import useAuthStore from '@/shared/store/authStore';
import { PageHeader } from '@/shared/ui';
import PhoneNumberInput from '@/shared/ui/PhoneNumberInput';
import { formatDate } from '@/shared/utils/formatters';
import {
  composePhoneNumber,
  DEFAULT_PHONE_COUNTRY,
  splitPhoneNumber,
} from '@/shared/constants/phoneCountries';
import { deleteImageFromMinio, uploadImageToMinio } from '@/shared/api/mediaUpload';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phoneCountryCode: z.string().trim().optional().refine(
    (v) => !v || /^\+\d{1,4}$/.test(v),
    'Select a valid country code'
  ),
  phoneLocalNumber: z.string().trim().optional().refine(
    (v) => !v || /^\d{6,12}$/.test(v),
    'Phone number should be 6-12 digits'
  ),
});

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [avatarObjectName, setAvatarObjectName] = useState(user?.avatarObjectName || '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [refreshingProfile, setRefreshingProfile] = useState(false);
  const [emailChangeRequesting, setEmailChangeRequesting] = useState(false);
  const [emailChangeConfirming, setEmailChangeConfirming] = useState(false);
  const [emailChangeModalOpen, setEmailChangeModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const parsedPhone = splitPhoneNumber(user?.phoneNumber || '');

  const { data: registrationsData } = useQuery({
    queryKey: ['profile-upcoming-registrations'],
    queryFn: () => attendeesApi.getMy().then((r) => r.data),
  });

  const registrations = Array.isArray(registrationsData)
    ? registrationsData
    : (registrationsData?.registrations || []);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingRegistrations = registrations
    .filter((registration) => ['REGISTERED', 'CHECKED_IN', 'WAITLISTED'].includes(registration.status))
    .filter((registration) => {
      if (!registration.eventDate) return true;
      const eventDate = new Date(registration.eventDate);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate >= today;
    })
    .slice(0, 4);

  useEffect(() => {
    setAvatarUrl(user?.avatarUrl || '');
    setAvatarObjectName(user?.avatarObjectName || '');
  }, [user?.avatarUrl, user?.avatarObjectName]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl('');
      return;
    }

    const preview = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [avatarFile]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phoneCountryCode: parsedPhone.countryCode || DEFAULT_PHONE_COUNTRY.dialCode,
      phoneLocalNumber: parsedPhone.localNumber || '',
    },
  });

  const phoneCountryCode = watch('phoneCountryCode', DEFAULT_PHONE_COUNTRY.dialCode);
  const phoneLocalNumber = watch('phoneLocalNumber', '');

  const persistAvatarFields = async (nextAvatarUrl, nextAvatarObjectName) => {
    const res = await authApi.updateMe({
      avatarUrl: nextAvatarUrl === '' ? null : (nextAvatarUrl || undefined),
      avatarObjectName: nextAvatarObjectName === '' ? null : (nextAvatarObjectName || undefined),
    });
    const updatedUser = res?.data?.data || res?.data?.user || res?.data || {};
    updateUser(updatedUser);
    setAvatarUrl(updatedUser?.avatarUrl || nextAvatarUrl || '');
    setAvatarObjectName(updatedUser?.avatarObjectName || nextAvatarObjectName || '');
    return updatedUser;
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const phoneNumber = composePhoneNumber(data.phoneCountryCode, data.phoneLocalNumber);
      const res = await authApi.updateMe({
        name: data.name,
        phoneNumber: phoneNumber || undefined,
        avatarUrl: avatarUrl || undefined,
        avatarObjectName: avatarObjectName || undefined,
      });
      const updatedUser = res?.data?.data || res?.data?.user || res?.data || {};
      updateUser(updatedUser);
      setAvatarUrl(updatedUser?.avatarUrl || avatarUrl || '');
      setAvatarObjectName(updatedUser?.avatarObjectName || avatarObjectName || '');
      setIsEditing(false);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    event.target.value = '';
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) {
      toast.error('Choose an avatar image first.');
      return;
    }

    setAvatarUploading(true);
    try {
      const uploaded = await uploadImageToMinio(avatarFile, { folder: 'eventzen/avatars' });
      await persistAvatarFields(uploaded.imageUrl, uploaded.objectName || '');
      setAvatarFile(null);
      toast.success('Avatar uploaded and saved.');
    } catch (err) {
      toast.error(err.message || 'Avatar upload failed');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    const currentAvatarUrl = avatarUrl;
    const currentAvatarObjectName = avatarObjectName;

    if (currentAvatarUrl) {
      try {
        await deleteImageFromMinio({ imageUrl: currentAvatarUrl, objectName: currentAvatarObjectName });
      } catch (err) {
        toast.error(err?.response?.data?.message || err.message || 'Could not delete profile photo from storage.');
        return;
      }
    }

    try {
      await persistAvatarFields('', '');
      setAvatarFile(null);
      toast.success('Profile photo removed and saved.');
    } catch (err) {
      setAvatarUrl(currentAvatarUrl || '');
      setAvatarObjectName(currentAvatarObjectName || '');
      toast.error(err?.response?.data?.message || err.message || 'Could not save profile photo removal.');
    }
  };

  const refreshProfile = async () => {
    setRefreshingProfile(true);
    try {
      const res = await authApi.getMe();
      const refreshedUser = res?.data?.data || res?.data?.user || res?.data || {};
      updateUser(refreshedUser);
      setAvatarUrl(refreshedUser?.avatarUrl || '');
      setAvatarObjectName(refreshedUser?.avatarObjectName || '');
      toast.success('Profile refreshed.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not refresh profile');
    } finally {
      setRefreshingProfile(false);
    }
  };

  const handleRequestEmailChange = async () => {
    if (!newEmail?.trim()) {
      toast.error('Enter a new email address first.');
      return;
    }

    setEmailChangeRequesting(true);
    try {
      await authApi.requestEmailChange({ newEmail: newEmail.trim() });
      toast.success('Verification code sent to your new email.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not request email change');
    } finally {
      setEmailChangeRequesting(false);
    }
  };

  const handleConfirmEmailChange = async () => {
    if (!newEmail?.trim() || !emailOtp?.trim()) {
      toast.error('Enter new email and OTP code.');
      return;
    }

    setEmailChangeConfirming(true);
    try {
      await authApi.confirmEmailChange({ newEmail: newEmail.trim(), otp: emailOtp.trim() });
      const me = await authApi.getMe();
      const refreshedUser = me?.data?.data || me?.data?.user || me?.data || {};
      updateUser(refreshedUser);
      setNewEmail('');
      setEmailOtp('');
      toast.success('Email updated after verification.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not confirm email change');
    } finally {
      setEmailChangeConfirming(false);
    }
  };

  const closeEmailChangeModal = () => {
    setEmailChangeModalOpen(false);
  };

  return (
    <div className="neo-container py-8">
      <PageHeader title="My Profile" subtitle="View your account details" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 lg:order-1 order-1">
        <div className="neo-card p-8">
          <div className="flex items-center gap-4 mb-8 pb-6 border-b-3 border-neo-black/10">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile avatar"
                className="w-16 h-16 rounded-full border-3 border-neo-black shadow-neo object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-neo-lavender border-3 border-neo-black shadow-neo
                            flex items-center justify-center font-heading text-2xl uppercase rounded-full">
                {user?.name?.[0] || '?'}
              </div>
            )}
            <div>
              <p className="font-heading text-lg uppercase tracking-wider">{user?.name}</p>
              <span className="neo-badge bg-neo-blue text-white text-[9px]">{user?.role}</span>
            </div>
          </div>

          {!isEditing ? (
            <div className="space-y-5">
              <div>
                <p className="neo-label">Name</p>
                <p className="neo-input bg-neo-cream">{user?.name || '-'}</p>
              </div>
              <div>
                <p className="neo-label">Email</p>
                <p className="neo-input bg-neo-cream">{user?.email || '-'}</p>
              </div>
              <div>
                <p className="neo-label">Phone</p>
                <p className="neo-input bg-neo-cream">{user?.phoneNumber || 'Not provided'}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="neo-btn-primary"
              >
                Edit Profile
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="neo-label" htmlFor="profile-name">Name</label>
              <input id="profile-name" type="text" autoComplete="name" {...register('name')} className="neo-input" />
              {errors.name && <p className="text-xs text-neo-red mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="neo-label" htmlFor="profile-email">Email</label>
              <input id="profile-email" type="email" autoComplete="email" {...register('email')} className="neo-input bg-neo-cream" readOnly />
              <p className="text-xs text-neo-black/65 mt-1">Email is your account identifier and cannot be edited directly here.</p>
              {errors.email && <p className="text-xs text-neo-red mt-1">{errors.email.message}</p>}
            </div>

            <PhoneNumberInput
              label="Phone"
              countryCode={phoneCountryCode}
              localNumber={phoneLocalNumber}
              localInputId="profile-phone"
              localInputName="profilePhoneDisplay"
              localAutoComplete="tel-national"
              onCountryCodeChange={(value) => setValue('phoneCountryCode', value, { shouldValidate: true })}
              onLocalNumberChange={(value) => setValue('phoneLocalNumber', value, { shouldValidate: true })}
              error={errors.phoneLocalNumber?.message || errors.phoneCountryCode?.message}
            />
            <input type="hidden" {...register('phoneCountryCode')} />
            <input type="hidden" {...register('phoneLocalNumber')} />

            <div>
              <label className="neo-label" htmlFor="profile-avatar">Profile Photo</label>
              <input
                id="profile-avatar"
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                disabled={avatarUploading}
                className="neo-input"
              />
              <p className="text-xs text-neo-black/65 mt-1">
                {avatarUploading ? 'Uploading avatar...' : 'Choose image, preview, then upload.'}
              </p>

              {avatarPreviewUrl ? (
                <div className="mt-3">
                  <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/65 mb-2">Selected Preview</p>
                  <img
                    src={avatarPreviewUrl}
                    alt="Selected avatar preview"
                    className="w-20 h-20 rounded-full border-3 border-neo-black object-cover"
                  />
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAvatarUpload}
                  disabled={avatarUploading || !avatarFile}
                  className="neo-btn neo-btn-sm bg-neo-white disabled:opacity-50"
                >
                  {avatarUploading ? 'Uploading...' : 'Upload Selected Image'}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="neo-btn neo-btn-sm bg-neo-white text-neo-red"
                >
                  Remove Current Image
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading || avatarUploading} className="neo-btn-primary disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                const nextParsedPhone = splitPhoneNumber(user?.phoneNumber || '');
                setValue('name', user?.name || '');
                setValue('email', user?.email || '');
                setValue('phoneCountryCode', nextParsedPhone.countryCode || DEFAULT_PHONE_COUNTRY.dialCode);
                setValue('phoneLocalNumber', nextParsedPhone.localNumber || '');
                setAvatarUrl(user?.avatarUrl || '');
                setAvatarObjectName(user?.avatarObjectName || '');
                setAvatarFile(null);
              }}
              className="neo-btn bg-neo-white"
            >
              Cancel
            </button>
          </form>
          )}
        </div>
        </div>

        <div className="lg:col-span-1 lg:order-2 order-2 space-y-4">
          <div className="neo-card p-5">
            <h3 className="font-heading text-sm uppercase tracking-wider mb-3">Account Actions</h3>
            <div className="space-y-2">
              {user?.role === 'CUSTOMER' && (
                <Link to="/vendor/apply" className="neo-btn neo-btn-sm bg-neo-green w-full justify-center">
                  Apply to be a Vendor
                </Link>
              )}
              <Link to="/vendor/applications/me" className="neo-btn neo-btn-sm bg-neo-white w-full justify-center">
                View Application Status
              </Link>
              <Link to="/dashboard" className="neo-btn neo-btn-sm bg-neo-white w-full justify-center">
                Open Dashboard
              </Link>
              <button
                type="button"
                onClick={() => setEmailChangeModalOpen(true)}
                className="neo-btn neo-btn-sm bg-neo-white w-full justify-center"
              >
                Change Email (Verification)
              </button>
              <button
                type="button"
                onClick={refreshProfile}
                disabled={refreshingProfile}
                className="neo-btn neo-btn-sm bg-neo-white w-full justify-center disabled:opacity-50"
              >
                {refreshingProfile ? 'Refreshing...' : 'Refresh Profile'}
              </button>
            </div>
          </div>

          <div className="neo-card p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="font-heading text-sm uppercase tracking-wider">Upcoming Registrations</h3>
              <span className="neo-badge bg-neo-yellow text-neo-black">{upcomingRegistrations.length}</span>
            </div>
            {upcomingRegistrations.length === 0 ? (
              <p className="font-body text-xs text-neo-black/70">
                No upcoming registered events yet. Open your dashboard to discover and register.
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingRegistrations.map((registration) => (
                  <div key={registration._id || registration.id} className="neo-card neo-card-no-hover p-3 bg-neo-cream">
                    <p className="font-heading text-[11px] uppercase tracking-wider">
                      {registration.eventTitle || `Event ${registration.eventId}`}
                    </p>
                    <p className="font-body text-[10px] text-neo-black/65 mt-1">
                      {registration.eventDate ? formatDate(registration.eventDate) : 'Date TBD'}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <Link to="/dashboard" className="neo-btn neo-btn-sm bg-neo-yellow w-full justify-center mt-3">
              Open Dashboard
            </Link>
          </div>
        </div>
      </div>

      {emailChangeModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/55" aria-hidden="true" />
          <div
            className="relative neo-card w-full max-w-md p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-email-change-modal-title"
          >
            <button
              type="button"
              onClick={closeEmailChangeModal}
              className="absolute top-3 right-3 neo-btn neo-btn-sm bg-neo-white"
              aria-label="Close email change dialog"
            >
              <HiX size={14} />
            </button>

            <h3 id="profile-email-change-modal-title" className="font-heading text-sm uppercase tracking-wider pr-10">
              Email Change Verification
            </h3>
            <p className="font-body text-xs text-neo-black/70 mt-2">
              Request an OTP for your new email, then confirm with the code. This dialog only closes from the X button.
            </p>

            <div className="mt-4 space-y-2">
              <label className="neo-label" htmlFor="profile-email-change-new">New Email</label>
              <input
                id="profile-email-change-new"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="neo-input"
                placeholder="new-email@example.com"
              />
              <button
                type="button"
                onClick={handleRequestEmailChange}
                disabled={emailChangeRequesting}
                className="neo-btn neo-btn-sm bg-neo-white w-full justify-center disabled:opacity-50"
              >
                {emailChangeRequesting ? 'Sending Code...' : 'Request Email Change OTP'}
              </button>

              <label className="neo-label" htmlFor="profile-email-change-otp">OTP Code</label>
              <input
                id="profile-email-change-otp"
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value)}
                className="neo-input"
                placeholder="Enter OTP code"
              />
              <button
                type="button"
                onClick={handleConfirmEmailChange}
                disabled={emailChangeConfirming}
                className="neo-btn neo-btn-sm bg-neo-green w-full justify-center disabled:opacity-50"
              >
                {emailChangeConfirming ? 'Confirming...' : 'Confirm Email Change'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
