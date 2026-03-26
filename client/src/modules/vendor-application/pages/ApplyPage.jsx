import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { vendorApplicationsApi } from '@/shared/api';
import { VENDOR_SERVICE_TYPES } from '@/shared/constants/enums';
import { PageHeader } from '@/shared/ui';

const schema = z.object({
  businessName: z.string().min(2, 'Required'),
  serviceType: z.string().min(1, 'Required'),
  description: z.string().min(10, 'At least 10 characters'),
  contactPhone: z.string().optional(),
  portfolioUrl: z.string().url().optional().or(z.literal('')),
});

export default function ApplyPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await vendorApplicationsApi.submit({
        businessName: data.businessName,
        serviceTypes: data.serviceType ? [data.serviceType] : [],
        portfolioUrl: data.portfolioUrl || undefined,
        notes: data.description,
      });
      toast.success('Application submitted!');
      navigate('/vendor/applications/me');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="neo-container py-8">
      <PageHeader title="Become a Vendor" subtitle="Submit your application to partner with EventZen" />
      <div className="max-w-xl">
        <div className="neo-card p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="neo-label" htmlFor="vendor-app-business-name">Business Name</label>
              <input
                id="vendor-app-business-name"
                autoComplete="organization"
                {...register('businessName')}
                className="neo-input"
                placeholder="Your business name"
              />
              {errors.businessName && <p className="text-xs text-neo-red mt-1">{errors.businessName.message}</p>}
            </div>
            <div>
              <label className="neo-label" htmlFor="vendor-app-service-type">Service Type</label>
              <select id="vendor-app-service-type" {...register('serviceType')} className="neo-select">
                <option value="">Select type</option>
                {VENDOR_SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {errors.serviceType && <p className="text-xs text-neo-red mt-1">{errors.serviceType.message}</p>}
            </div>
            <div>
              <label className="neo-label" htmlFor="vendor-app-description">Description</label>
              <textarea
                id="vendor-app-description"
                {...register('description')}
                className="neo-textarea"
                placeholder="Describe your services..."
              />
              {errors.description && <p className="text-xs text-neo-red mt-1">{errors.description.message}</p>}
            </div>
            <div>
              <label className="neo-label" htmlFor="vendor-app-contact-phone">Contact Phone</label>
              <input
                id="vendor-app-contact-phone"
                type="tel"
                autoComplete="tel"
                {...register('contactPhone')}
                className="neo-input"
                placeholder="+91 9876543210"
              />
            </div>
            <div>
              <label className="neo-label" htmlFor="vendor-app-portfolio-url">Portfolio URL</label>
              <input
                id="vendor-app-portfolio-url"
                autoComplete="url"
                {...register('portfolioUrl')}
                className="neo-input"
                placeholder="https://yoursite.com"
              />
              {errors.portfolioUrl && <p className="text-xs text-neo-red mt-1">{errors.portfolioUrl.message}</p>}
            </div>
            <button type="submit" disabled={loading} className="w-full neo-btn-primary neo-btn-lg disabled:opacity-50">
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
