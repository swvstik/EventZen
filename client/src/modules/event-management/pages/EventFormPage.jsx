import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { eventsApi, scheduleApi, venuesApi } from '@/shared/api';
import { EVENT_CATEGORIES } from '@/shared/constants/enums';
import { Drawer, PageHeader } from '@/shared/ui';
import TimePicker from '@/shared/ui/TimePicker';
import TicketTierEditor from '../components/TicketTierEditor';
import { deleteImageFromMinio, uploadImageToMinio } from '@/shared/api/mediaUpload';
import useAuthStore from '@/shared/store/authStore';
import {
  formatWindowDateRange,
  formatWindowTime,
  isWindowOverlapping,
  normalizeEventAvailabilityByVenue,
  toTimestamp,
  toTimestampFromEventWindow,
} from '@/shared/utils/availability';

function findFirstErrorPath(errorNode, parentPath = '') {
  if (!errorNode || typeof errorNode !== 'object') return null;

  if (typeof errorNode.message === 'string' && errorNode.message.trim().length > 0) {
    return parentPath || null;
  }

  const keys = Object.keys(errorNode);
  for (const key of keys) {
    const nextPath = parentPath ? `${parentPath}.${key}` : key;
    const found = findFirstErrorPath(errorNode[key], nextPath);
    if (found) return found;
  }

  return null;
}

const EVENTS_FETCH_PAGE_SIZE = 200;
const EVENTS_FETCH_MAX_PAGES = 6;

function mergeAvailabilityWindows(primary = {}, fallback = {}) {
  const merged = {};
  const venueIds = new Set([...Object.keys(primary), ...Object.keys(fallback)]);

  venueIds.forEach((venueId) => {
    const seen = new Set();
    const next = [];
    [...(primary[venueId] || []), ...(fallback[venueId] || [])].forEach((window) => {
      const key = `${window.startTime}-${window.endTime}-${window.eventId || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      next.push(window);
    });
    merged[venueId] = next;
  });

  return merged;
}

function toStatusLabel(value) {
  return String(value || 'BOOKED').replaceAll('_', ' ');
}

function splitOwnVenueMeta(description) {
  const content = String(description || '');
  const markerRegex = /(?:\r?\n){0,2}\[Own Venue\]\r?\n/i;
  const match = markerRegex.exec(content);
  if (!match) {
    return { base: content.trimEnd(), meta: '' };
  }

  const base = content.slice(0, match.index).trimEnd();
  const meta = content.slice(match.index + match[0].length).trim();
  return { base, meta };
}

function stripOwnVenueDetails(description) {
  return splitOwnVenueMeta(description).base;
}

function extractOwnVenueDetails(description) {
  const { meta } = splitOwnVenueMeta(description);
  if (!meta) return { ownVenueName: '', ownVenueAddress: '' };

  const [name = '', address = ''] = meta.split('|').map((part) => part.trim());
  return { ownVenueName: name, ownVenueAddress: address };
}

// Validation schemas
const tierSchema = z.object({
  id: z.preprocess(
    (value) => {
      if (value === '' || value === undefined) return null;
      return value;
    },
    z.coerce.number().int().positive().nullable().optional()
  ),
  name: z.string().min(1, 'Required'),
  price: z.coerce.number().min(0, '≥ 0'),
  capacity: z.coerce.number().int().min(1, '≥ 1'),
  maxPerOrder: z.coerce.number().int().min(1, '≥ 1').default(10),
  currency: z.string().default('INR'),
  description: z.string().optional(),
});

const schema = z.object({
  title: z.string().min(1, 'Title required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  eventDate: z.string().min(1, 'Date required'),
  endDate: z.string().optional(),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  category: z.string().min(1, 'Category required'),
  bannerImageUrl: z.string().optional(),
  venueMode: z.enum(['eventzen', 'own', 'online']).default('eventzen'),
  venueId: z.coerce.number().optional().nullable(),
  ownVenueName: z.string().optional(),
  ownVenueAddress: z.string().optional(),
  tags: z.string().optional(),
  allowWaitlist: z.boolean().default(true),
  ticketTiers: z.array(tierSchema).min(1, 'At least one tier'),
}).refine(d => !d.startTime || !d.endTime || d.endTime > d.startTime, {
  message: 'End time must be after start time', path: ['endTime'],
}).refine(d => !d.endDate || d.endDate >= d.eventDate, {
  message: 'End date must be on or after start date', path: ['endDate'],
}).superRefine((data, ctx) => {
  if (data.venueMode === 'eventzen' && !data.venueId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['venueId'],
      message: 'Select an EventZen venue or switch venue mode.',
    });
  }

  if (data.venueMode === 'own') {
    if (!String(data.ownVenueName || '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ownVenueName'],
        message: 'Own venue name is required.',
      });
    }
    if (!String(data.ownVenueAddress || '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ownVenueAddress'],
        message: 'Own venue address is required.',
      });
    }
  }
});

async function fetchEventsSnapshot() {
  const rows = [];
  for (let page = 0; page < EVENTS_FETCH_MAX_PAGES; page += 1) {
    const response = await eventsApi.getAll({ page, limit: EVENTS_FETCH_PAGE_SIZE });
    const payload = response?.data || {};
    const pageRows = Array.isArray(payload?.events) ? payload.events : [];
    rows.push(...pageRows);

    const totalPages = Number(payload?.totalPages || 0);
    if (pageRows.length === 0 || (totalPages > 0 && page >= totalPages - 1)) {
      break;
    }
  }
  return rows;
}

function extractEventIdFromResponse(response) {
  return response?.data?.data?.id || response?.data?.id || null;
}

// Page
export default function EventFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isEdit = !!id;
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [slotDraft, setSlotDraft] = useState({ sessionTitle: '', sessionDate: '', startTime: '', endTime: '', speakerName: '', locationNote: '' });
  const [editingPersistedSlotId, setEditingPersistedSlotId] = useState(null);
  const [editingDraftSlotIndex, setEditingDraftSlotIndex] = useState(null);
  const [draftScheduleSlots, setDraftScheduleSlots] = useState([]);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [pendingPublishData, setPendingPublishData] = useState(null);
  const queryClient = useQueryClient();
  const isVendor = user?.role === 'VENDOR';

  const { data: eventData } = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsApi.getById(id).then(r => r.data),
    enabled: isEdit,
  });

  const { data: persistedScheduleData = [] } = useQuery({
    queryKey: ['event-schedule-persisted', id],
    queryFn: () => scheduleApi.getByEvent(id).then((r) => r.data || []),
    enabled: isEdit,
  });

  const { data: venuesData } = useQuery({
    queryKey: ['venues'],
    queryFn: () => venuesApi.getAll().then(r => r.data?.venues || r.data || []),
  });

  const venues = Array.isArray(venuesData) ? venuesData : [];

  const { data: allEventsData } = useQuery({
    queryKey: ['events-for-venue-availability'],
    queryFn: fetchEventsSnapshot,
  });

  const derivedEventAvailabilityByVenue = normalizeEventAvailabilityByVenue(
    Array.isArray(allEventsData) ? allEventsData : [],
    isEdit ? id : null
  );

  const { register, handleSubmit, control, reset, setValue, watch, trigger, setFocus, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '', description: '', eventDate: '', endDate: '', startTime: '', endTime: '',
      category: 'TECH', bannerImageUrl: '', venueMode: 'eventzen', venueId: null, ownVenueName: '', ownVenueAddress: '', tags: '',
      allowWaitlist: true,
      ticketTiers: [{ name: 'General', price: 0, capacity: 100, maxPerOrder: 10, currency: 'INR', description: '' }],
    },
  });

  const watchEventDate = watch('eventDate');
  const watchEndDate = watch('endDate');
  const watchStartTime = watch('startTime');
  const watchEndTime = watch('endTime');
  const watchVenueMode = watch('venueMode');
  const watchTitle = watch('title');
  const watchDescriptionText = watch('description');
  const watchCategory = watch('category');
  const watchTags = watch('tags');
  const watchOwnVenueName = watch('ownVenueName');
  const watchOwnVenueAddress = watch('ownVenueAddress');
  const watchTicketTiers = watch('ticketTiers');
  const selectedVenueId = watch('venueId');
  const shouldUseManagedVenue = watchVenueMode === 'eventzen';
  const canEvaluateVenueWindow = Boolean(shouldUseManagedVenue && watchEventDate && watchStartTime && watchEndTime);

  const { data: venueAvailabilityById = {} } = useQuery({
    queryKey: ['venues-availability-bulk', watchEventDate, watchEndDate, watchStartTime, watchEndTime, venues.map((v) => v.id).join(',')],
    queryFn: async () => {
      try {
        const response = await venuesApi.getAvailabilityBulk(venues.map((venue) => venue.id));
        const payload = response?.data && typeof response.data === 'object' ? response.data : {};
        return Object.fromEntries(
          venues.map((venue) => {
            const windows = payload[String(venue.id)] ?? payload[venue.id] ?? [];
            return [String(venue.id), Array.isArray(windows) ? windows : []];
          })
        );
      } catch {
        return Object.fromEntries(venues.map((venue) => [String(venue.id), []]));
      }
    },
    enabled: shouldUseManagedVenue && venues.length > 0 && canEvaluateVenueWindow,
  });

  const mergedAvailabilityByVenue = mergeAvailabilityWindows(venueAvailabilityById, derivedEventAvailabilityByVenue);

  const selectedVenue = shouldUseManagedVenue
    ? venues.find((venue) => String(venue.id) === String(selectedVenueId))
    : null;
  const selectedVenueCapacity = Number(selectedVenue?.capacity || 0);
  const totalTicketTierCapacity = Array.isArray(watchTicketTiers)
    ? watchTicketTiers.reduce((sum, tier) => sum + Number(tier?.capacity || 0), 0)
    : 0;
  const ticketCapacityError = shouldUseManagedVenue
    && selectedVenue
    && selectedVenueCapacity > 0
    && totalTicketTierCapacity > selectedVenueCapacity
    ? `Total ticket capacity (${totalTicketTierCapacity}) cannot exceed venue capacity (${selectedVenueCapacity}).`
    : '';
  const selectedVenueWindows = mergedAvailabilityByVenue[String(selectedVenueId)] || [];
  const targetStart = canEvaluateVenueWindow ? toTimestampFromEventWindow(watchEventDate, watchStartTime, '00:00') : null;
  const targetEnd = canEvaluateVenueWindow
    ? toTimestampFromEventWindow(watchEndDate || watchEventDate, watchEndTime, '23:59')
    : null;

  const selectedVenueConflicts = canEvaluateVenueWindow
    ? selectedVenueWindows.filter((window) => {
      if (isEdit && String(window.eventId) === String(id)) return false;
      const startTs = toTimestamp(window.startTime);
      const endTs = toTimestamp(window.endTime);
      return isWindowOverlapping(targetStart, targetEnd, startTs, endTs);
    })
    : [];
  const selectedVenueHasConflict = selectedVenueConflicts.length > 0;
  const isCancelledReadOnly = Boolean(isEdit && eventData?.status === 'CANCELLED');

  const venueUnavailableIds = canEvaluateVenueWindow ? new Set(
    venues
      .filter((venue) => {
        const blocks = mergedAvailabilityByVenue[String(venue.id)] || [];
        return blocks.some((block) => {
          if (isEdit && String(block.eventId) === String(id)) return false;
          const blockStart = toTimestamp(block.startTime);
          const blockEnd = toTimestamp(block.endTime);
          return isWindowOverlapping(targetStart, targetEnd, blockStart, blockEnd);
        });
      })
      .map((venue) => String(venue.id))
  ) : new Set();

  useEffect(() => {
    if (eventData) {
      const tags = eventData.tags
        ? (Array.isArray(eventData.tags) ? eventData.tags.join(', ') : String(eventData.tags))
        : '';
      const ownVenueDetails = extractOwnVenueDetails(eventData.description || '');
      const ownVenueName = eventData.ownVenueName || ownVenueDetails.ownVenueName;
      const ownVenueAddress = eventData.ownVenueAddress || ownVenueDetails.ownVenueAddress;
      const hasManagedVenue = Boolean(eventData.venue?.id || eventData.venueId);
      const venueMode = hasManagedVenue
        ? 'eventzen'
        : (ownVenueName || ownVenueAddress ? 'own' : 'online');

      reset({
        ...eventData,
        description: stripOwnVenueDetails(eventData.description || ''),
        tags,
        allowWaitlist: eventData.allowWaitlist !== false,
        endDate: eventData.endDate || eventData.eventDate || '',
        venueMode,
        venueId: eventData.venue?.id || eventData.venueId || null,
        ownVenueName,
        ownVenueAddress,
        ticketTiers: eventData.ticketTiers || [{ name: 'General', price: 0, capacity: 100, maxPerOrder: 10, currency: 'INR', description: '' }],
      });
    }
  }, [eventData, reset]);

  useEffect(() => {
    if (isCancelledReadOnly) {
      setCurrentStep(3);
    }
  }, [isCancelledReadOnly]);

  useEffect(() => {
    if (watchVenueMode !== 'eventzen' && selectedVenueId) {
      setValue('venueId', null, { shouldDirty: true, shouldValidate: true });
    }
  }, [watchVenueMode, selectedVenueId, setValue]);

  const bannerImageUrl = watch('bannerImageUrl');

  useEffect(() => {
    if (!bannerFile) {
      setBannerPreviewUrl('');
      return;
    }

    const preview = URL.createObjectURL(bannerFile);
    setBannerPreviewUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [bannerFile]);

  const handleBannerFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    event.target.value = '';
  };

  const handleBannerUpload = async () => {
    if (!bannerFile) {
      toast.error('Choose a banner image first.');
      return;
    }

    setBannerUploading(true);
    try {
      const uploaded = await uploadImageToMinio(bannerFile, { folder: 'eventzen/events' });
      setValue('bannerImageUrl', uploaded.imageUrl, { shouldDirty: true, shouldValidate: true });
      setBannerFile(null);
      toast.success('Banner uploaded. You can now save the event.');
    } catch (err) {
      toast.error(err.message || 'Banner upload failed');
    } finally {
      setBannerUploading(false);
    }
  };

  const clearBannerImage = async () => {
    if (bannerImageUrl) {
      try {
        const normalizedImageUrl = typeof bannerImageUrl === 'string'
          ? bannerImageUrl
          : (bannerImageUrl?.imageUrl || '');
        await deleteImageFromMinio({ imageUrl: normalizedImageUrl });
      } catch (err) {
        toast.error(err?.response?.data?.message || err.message || 'Could not delete banner image from storage.');
        return;
      }
    }

    setBannerFile(null);
    setValue('bannerImageUrl', '', { shouldDirty: true, shouldValidate: true });
    toast.success('Banner image removed from this event draft.');
  };

  const clearScheduleDraftForm = () => {
    setEditingPersistedSlotId(null);
    setEditingDraftSlotIndex(null);
    setSlotDraft({ sessionTitle: '', sessionDate: watchEventDate || '', startTime: '', endTime: '', speakerName: '', locationNote: '' });
  };

  useEffect(() => {
    setSlotDraft((current) => {
      if (current.sessionDate) return current;
      return { ...current, sessionDate: watchEventDate || '' };
    });
  }, [watchEventDate]);

  const saveMutation = useMutation({
    mutationFn: async ({ data, intent = 'draft' }) => {
      const managedVenueMode = data.venueMode === 'eventzen';
      const ownVenueMode = data.venueMode === 'own';
      const onlineVenueMode = data.venueMode === 'online';
      const payload = {
        ...data,
        description: stripOwnVenueDetails(data.description),
        endDate: data.endDate && data.endDate >= data.eventDate ? data.endDate : undefined,
        tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        allowWaitlist: data.allowWaitlist !== false,
        venueId: managedVenueMode ? (data.venueId || undefined) : null,
        ownVenueName: ownVenueMode
          ? (String(data.ownVenueName || '').trim() || undefined)
          : (onlineVenueMode ? '' : undefined),
        ownVenueAddress: ownVenueMode
          ? (String(data.ownVenueAddress || '').trim() || undefined)
          : (onlineVenueMode ? '' : undefined),
      };
      delete payload.venueMode;

      const totalTierCapacity = Array.isArray(data.ticketTiers)
        ? data.ticketTiers.reduce((sum, tier) => sum + Number(tier.capacity || 0), 0)
        : 0;

      if (managedVenueMode && payload.venueId) {
        const selectedVenue = venues.find((v) => String(v.id) === String(payload.venueId));
        const venueCapacity = Number(selectedVenue?.capacity || 0);
        if (venueCapacity > 0 && totalTierCapacity > venueCapacity) {
          throw new Error(`Total ticket capacity (${totalTierCapacity}) cannot exceed venue capacity (${venueCapacity}).`);
        }

        if (data.eventDate && data.startTime && data.endTime) {
          const venueWindows = mergedAvailabilityByVenue[String(payload.venueId)] || [];
          const requestStart = toTimestampFromEventWindow(data.eventDate, data.startTime, '00:00');
          const requestEnd = toTimestampFromEventWindow(data.endDate || data.eventDate, data.endTime, '23:59');

          const hasConflict = venueWindows.some((window) => {
            if (isEdit && String(window.eventId) === String(id)) return false;
            const startTs = toTimestamp(window.startTime);
            const endTs = toTimestamp(window.endTime);
            return isWindowOverlapping(requestStart, requestEnd, startTs, endTs);
          });

          if (hasConflict) {
            throw new Error('Selected venue is unavailable for the chosen date/time window.');
          }
        }
      }

      if (isCancelledReadOnly) {
        throw new Error('Cancelled events are read-only.');
      }

      if (isEdit) {
        return eventsApi.update(id, payload);
      }

      // Create a single event (with optional endDate for multi-day)
      payload.saveAsDraft = intent !== 'publish';
      const response = await eventsApi.create(payload);
      const createdEventId = extractEventIdFromResponse(response);

      let scheduleFailures = 0;
      if (draftScheduleSlots.length > 0 && createdEventId) {
        for (const slot of draftScheduleSlots) {
          try {
            await scheduleApi.create(createdEventId, {
              sessionTitle: slot.sessionTitle,
              sessionDate: slot.sessionDate,
              startTime: slot.startTime,
              endTime: slot.endTime,
              speakerName: slot.speakerName || undefined,
              locationNote: slot.locationNote || undefined,
            });
          } catch {
            scheduleFailures += 1;
          }
        }
      }

      return { data: { scheduleFailures, createIntent: intent } };
    },
    onSuccess: (res, vars) => {
      const scheduleFailures = Number(res?.data?.scheduleFailures || 0);
      const intent = vars?.intent || 'draft';
      if (isEdit) {
        toast.success('Event updated!');
      } else if (intent === 'publish') {
        toast.success(isVendor ? 'Event submitted for admin approval!' : 'Event published!');
      } else {
        toast.success('Draft saved!');
      }
      if (scheduleFailures > 0) {
        toast.error(`${scheduleFailures} schedule slot operations failed after event creation.`);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['events-for-venue-availability'] });
      navigate('/admin/events');
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || 'Save failed'),
  });

  const submitMutation = useMutation({
    mutationFn: () => eventsApi.submit(id),
    onSuccess: () => { toast.success('Submitted for approval!'); navigate('/admin/events'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Submit failed'),
  });

  const createSlotMutation = useMutation({
    mutationFn: (payload) => scheduleApi.create(id, payload),
    onSuccess: () => {
      toast.success('Schedule slot added.');
      clearScheduleDraftForm();
      queryClient.invalidateQueries({ queryKey: ['event-schedule-persisted', id] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not add slot'),
  });

  const updateSlotMutation = useMutation({
    mutationFn: ({ slotId, payload }) => scheduleApi.updateSlot(slotId, payload),
    onSuccess: () => {
      toast.success('Schedule slot updated.');
      clearScheduleDraftForm();
      queryClient.invalidateQueries({ queryKey: ['event-schedule-persisted', id] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update slot'),
  });

  const deleteSlotMutation = useMutation({
    mutationFn: (slotId) => scheduleApi.deleteSlot(slotId),
    onSuccess: () => {
      toast.success('Schedule slot deleted.');
      queryClient.invalidateQueries({ queryKey: ['event-schedule-persisted', id] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not delete slot'),
  });

  const handleScheduleSlotSave = () => {
    if (!slotDraft.sessionTitle?.trim()) {
      toast.error('Session title is required.');
      return;
    }
    if (!slotDraft.sessionDate) {
      toast.error('Session date is required.');
      return;
    }

    if (!watchEventDate) {
      toast.error('Set event date before adding schedule slots.');
      return;
    }

    const eventStartDate = new Date(watchEventDate);
    const eventEndDate = new Date(watchEndDate || watchEventDate);
    const slotDate = new Date(slotDraft.sessionDate);
    eventStartDate.setHours(0, 0, 0, 0);
    eventEndDate.setHours(0, 0, 0, 0);
    slotDate.setHours(0, 0, 0, 0);

    if (slotDate < eventStartDate || slotDate > eventEndDate) {
      toast.error('Session date must be within the event date range.');
      return;
    }

    if (!slotDraft.startTime || !slotDraft.endTime) {
      toast.error('Start time and end time are required.');
      return;
    }
    if (slotDraft.endTime <= slotDraft.startTime) {
      toast.error('End time must be after start time.');
      return;
    }

    const payload = {
      sessionTitle: slotDraft.sessionTitle.trim(),
      sessionDate: slotDraft.sessionDate,
      startTime: slotDraft.startTime || undefined,
      endTime: slotDraft.endTime || undefined,
      speakerName: slotDraft.speakerName?.trim() || undefined,
      locationNote: slotDraft.locationNote?.trim() || undefined,
    };

    if (isEdit) {
      if (editingPersistedSlotId) {
        updateSlotMutation.mutate({ slotId: editingPersistedSlotId, payload });
        return;
      }
      createSlotMutation.mutate(payload);
      return;
    }

    if (editingDraftSlotIndex !== null) {
      setDraftScheduleSlots((current) => current.map((slot, index) => (index === editingDraftSlotIndex ? payload : slot)));
      toast.success('Draft schedule slot updated.');
    } else {
      setDraftScheduleSlots((current) => [...current, payload]);
      toast.success('Draft schedule slot added.');
    }
    clearScheduleDraftForm();
  };

  const persistedSchedule = Array.isArray(persistedScheduleData) ? persistedScheduleData : [];
  const isSlotMutating = createSlotMutation.isPending || updateSlotMutation.isPending || deleteSlotMutation.isPending;
  const isSaving = saveMutation.isPending || bannerUploading;
  const formSteps = ['Basic Info', 'Tickets', 'Schedule', 'Review'];

  const getStepFromErrorPath = (path) => {
    const fieldPath = String(path || '').toLowerCase();
    if (!fieldPath) return 0;
    if (fieldPath.startsWith('tickettiers')) return 1;
    if (fieldPath.startsWith('scheduleslots')) return 2;
    return 0;
  };

  const focusFieldForPath = (path) => {
    if (!path) return;
    const normalized = String(path).replace(/\.(\d+)\./g, '.$1.');
    setFocus(normalized);
  };

  const handleInvalidSubmit = (formErrors) => {
    const firstErrorPath = findFirstErrorPath(formErrors);
    const targetStep = getStepFromErrorPath(firstErrorPath);
    setCurrentStep(targetStep);

    if (firstErrorPath) {
      focusFieldForPath(firstErrorPath);
    }

    const stepLabel = formSteps[targetStep] || 'form';
    toast.error(`Please fix errors in ${stepLabel} before saving.`);
  };

  const validateCurrentStep = async () => {
    if (currentStep === 0) {
      const basicFields = ['title', 'description', 'eventDate', 'endDate', 'startTime', 'endTime', 'category', 'venueMode'];
      if (watchVenueMode === 'eventzen') {
        basicFields.push('venueId');
      }
      if (watchVenueMode === 'own') {
        basicFields.push('ownVenueName', 'ownVenueAddress');
      }
      const isValid = await trigger(basicFields);
      if (!isValid) {
        toast.error('Fix basic information errors before continuing.');
      }
      return isValid;
    }

    if (currentStep === 1) {
      const isValid = await trigger(['ticketTiers']);
      if (!isValid || Boolean(ticketCapacityError)) {
        if (ticketCapacityError) {
          toast.error(ticketCapacityError);
          return false;
        }
        toast.error('Fix ticket tier errors before continuing.');
        return false;
      }
      return true;
    }

    return true;
  };

  const handleSaveDraft = handleSubmit((data) => {
    saveMutation.mutate({ data, intent: 'draft' });
  }, handleInvalidSubmit);

  const handlePromptPublish = handleSubmit((data) => {
    setPendingPublishData(data);
    setPublishConfirmOpen(true);
  }, handleInvalidSubmit);

  const handleCreatePublish = handleSubmit((data) => {
    saveMutation.mutate({ data, intent: 'publish' });
  }, handleInvalidSubmit);

  const handleConfirmPublish = () => {
    if (!pendingPublishData) {
      setPublishConfirmOpen(false);
      return;
    }
    saveMutation.mutate({ data: pendingPublishData, intent: 'publish' });
    setPublishConfirmOpen(false);
    setPendingPublishData(null);
  };

  return (
    <div>
      <PageHeader title={isEdit ? 'Edit Event' : 'Create Event'} subtitle="Fill in event details" />

      {isCancelledReadOnly && (
        <div className="neo-card neo-card-no-hover p-3 mb-4 bg-neo-cream border-3 border-neo-black">
          <p className="font-heading text-xs uppercase tracking-wider">Read-only mode</p>
          <p className="font-body text-xs text-neo-black/70 mt-1">
            This event is cancelled. Details are view-only and cannot be saved.
          </p>
        </div>
      )}

      <form onSubmit={handleSaveDraft} className="space-y-8 max-w-6xl">
        {!isCancelledReadOnly && (
        <div className="neo-card neo-card-no-hover p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {formSteps.map((stepLabel, index) => {
              const isActiveStep = index === currentStep;
              const isCompletedStep = index < currentStep;
              return (
                <button
                  key={stepLabel}
                  type="button"
                  onClick={() => {
                    if (index <= currentStep) {
                      setCurrentStep(index);
                    }
                  }}
                  disabled={index > currentStep}
                  className={`neo-btn neo-btn-sm justify-center ${
                    isActiveStep
                      ? 'bg-neo-yellow'
                      : isCompletedStep
                        ? 'bg-neo-green'
                        : 'bg-neo-white'
                  } disabled:opacity-60`}
                >
                  {index + 1}. {stepLabel}
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* Basic info */}
        {currentStep === 0 && (
        <div className="neo-card neo-card-no-hover neo-retroui-panel p-6 space-y-5">
          <h2 className="font-heading text-sm uppercase tracking-wider border-b-3 border-neo-black/10 pb-3">
            Basic Information
          </h2>
          <div>
            <label className="neo-label" htmlFor="event-title">Title</label>
            <input id="event-title" {...register('title')} className="neo-input" placeholder="Event title" />
            {errors.title && <p className="text-xs text-neo-red mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="neo-label" htmlFor="event-description">Description</label>
            <textarea id="event-description" {...register('description')} className="neo-textarea" placeholder="Describe your event..." />
            {errors.description && <p className="text-xs text-neo-red mt-1">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
            <div>
              <label className="neo-label" htmlFor="event-date">Date</label>
              <input
                id="event-date"
                type="date"
                value={watchEventDate || ''}
                onChange={(e) => setValue('eventDate', e.target.value || '', { shouldDirty: true, shouldValidate: true })}
                className="neo-input"
              />
              {errors.eventDate && <p className="text-xs text-neo-red mt-1">{errors.eventDate.message}</p>}
            </div>
            <div>
              <label className="neo-label" htmlFor="event-start-time">Start Time</label>
              <TimePicker
                id="event-start-time"
                value={watchStartTime}
                onChange={(val) => setValue('startTime', val || '', { shouldDirty: true, shouldValidate: true })}
                className="w-full"
              />
              {errors.startTime && <p className="text-xs text-neo-red mt-1">{errors.startTime.message}</p>}
            </div>
            <div>
              <label className="neo-label" htmlFor="event-end-date">End Date</label>
              <input
                id="event-end-date"
                type="date"
                value={watch('endDate') || ''}
                min={watchEventDate || undefined}
                onChange={(e) => setValue('endDate', e.target.value || '', { shouldDirty: true, shouldValidate: true })}
                className="neo-input"
              />
              {errors.endDate && <p className="text-xs text-neo-red mt-1">{errors.endDate.message}</p>}
            </div>
            <div>
              <label className="neo-label" htmlFor="event-end-time">End Time</label>
              <TimePicker
                id="event-end-time"
                value={watchEndTime}
                onChange={(val) => setValue('endTime', val || '', { shouldDirty: true, shouldValidate: true })}
                className="w-full"
              />
              {errors.endTime && <p className="text-xs text-neo-red mt-1">{errors.endTime.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="neo-label" htmlFor="event-category">Category</label>
              <select id="event-category" {...register('category')} className="neo-select">
                {EVENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="neo-label" htmlFor="event-venue-mode">Venue Mode</label>
              <select id="event-venue-mode" {...register('venueMode')} className="neo-select">
                <option value="eventzen">Use EventZen Venue</option>
                <option value="own">Own Venue (External)</option>
                <option value="online">Online / No Venue</option>
              </select>
              <p className="text-xs text-neo-black/65 mt-1">
                Own venue and online events are not managed in EventZen venue booking.
              </p>
            </div>
          </div>

          <div className="neo-card neo-card-no-hover neo-retroui-inset p-3">
            <label className="inline-flex items-center gap-2 cursor-pointer" htmlFor="event-allow-waitlist">
              <input
                id="event-allow-waitlist"
                type="checkbox"
                {...register('allowWaitlist')}
                className="w-4 h-4"
              />
              <span className="font-heading text-xs uppercase tracking-wider">Allow waitlist when tickets are sold out</span>
            </label>
            <p className="text-xs text-neo-black/65 mt-1">
              If disabled, sold-out tiers will show as sold out and new registrations will be blocked.
            </p>
          </div>

          {watchVenueMode === 'eventzen' && (
            <div>
              <label className="neo-label" htmlFor="event-venue">Venue</label>
              <select id="event-venue" {...register('venueId')} className="neo-select">
                <option value="">Select EventZen venue</option>
                {venues.map(v => (
                  <option
                    key={v.id}
                    value={v.id}
                    disabled={
                      venueUnavailableIds.has(String(v.id))
                      && String(v.id) !== String(selectedVenueId)
                    }
                  >
                    {v.name}{venueUnavailableIds.has(String(v.id)) ? ' (Unavailable for selected slot)' : ''}
                  </option>
                ))}
              </select>
              {errors.venueId && <p className="text-xs text-neo-red mt-1">{errors.venueId.message}</p>}
              <p className="text-xs text-neo-black/65 mt-1">
                Tip: pick date and time first to see availability-aware venue options.
              </p>
              <button
                type="button"
                onClick={() => navigate(user?.role === 'ADMIN' ? '/admin/venues' : '/admin/venues/view')}
                className="neo-btn neo-btn-sm bg-neo-white mt-2"
              >
                Find/List Venues
              </button>
            </div>
          )}

          {watchVenueMode === 'own' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="neo-label" htmlFor="event-own-venue-name">Own Venue Name</label>
                <input
                  id="event-own-venue-name"
                  {...register('ownVenueName')}
                  className="neo-input"
                  placeholder="Your venue name"
                />
                {errors.ownVenueName && <p className="text-xs text-neo-red mt-1">{errors.ownVenueName.message}</p>}
              </div>
              <div>
                <label className="neo-label" htmlFor="event-own-venue-address">Own Venue Address</label>
                <input
                  id="event-own-venue-address"
                  {...register('ownVenueAddress')}
                  className="neo-input"
                  placeholder="Venue address"
                />
                {errors.ownVenueAddress && <p className="text-xs text-neo-red mt-1">{errors.ownVenueAddress.message}</p>}
              </div>
            </div>
          )}

          {watchVenueMode === 'eventzen' && selectedVenue && (
            <div className="neo-card neo-card-no-hover neo-retroui-inset p-4 bg-neo-cream border-3 border-neo-black/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-heading text-xs uppercase tracking-wider">Selected Venue Details</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedVenue.name || ''} ${selectedVenue.address || ''}`.trim())}`}
                  target="_blank"
                  rel="noreferrer"
                  className="neo-btn neo-btn-sm bg-neo-white"
                >
                  Open in Maps
                </a>
              </div>
              <p className="font-body text-sm mt-2"><strong>Name:</strong> {selectedVenue.name}</p>
              <p className="font-body text-sm"><strong>Address:</strong> {selectedVenue.address || 'N/A'}</p>
              <p className="font-body text-sm"><strong>Capacity:</strong> {selectedVenue.capacity || 'N/A'}</p>
              <p className="font-body text-sm">
                <strong>Rent / Day:</strong> {selectedVenue.dailyRate
                  ? `${(selectedVenue.rateCurrency || 'INR').toUpperCase()} ${Number(selectedVenue.dailyRate).toLocaleString()}`
                  : 'Not configured'}
              </p>
              {selectedVenue.amenities && (
                <p className="font-body text-sm"><strong>Amenities:</strong> {selectedVenue.amenities}</p>
              )}

              <div className="mt-3">
                <p className="font-heading text-[10px] uppercase tracking-wider text-neo-black/70 mb-1">Availability</p>
                {selectedVenueWindows.length === 0 ? (
                  <p className="font-body text-xs text-neo-black/65">No current booking conflicts found for this venue.</p>
                ) : (
                  <div className="space-y-1">
                    {selectedVenueWindows.slice(0, 6).map((window) => (
                      <div key={window.id || `${window.startTime}-${window.endTime}`} className="neo-card neo-card-no-hover neo-retroui-inset p-2">
                        <p className="font-body text-[10px] text-neo-black/70">
                          {formatWindowDateRange(window.startTime, window.endTime)} | {formatWindowTime(window.startTime)} - {formatWindowTime(window.endTime)}
                        </p>
                        <p className="font-body text-[10px] text-neo-black/65">{window.eventTitle || `Event #${window.eventId}`}</p>
                        <p className="font-body text-[10px] text-neo-black/55">{toStatusLabel(window.status)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedVenueHasConflict && (
                <div className="mt-3 neo-card p-3 border-3 border-neo-red bg-neo-red/10">
                  <p className="font-heading text-[10px] uppercase tracking-wider text-neo-red">Selected Slot Conflicts</p>
                  <p className="font-body text-xs text-neo-red mt-1">
                    This venue is already blocked for the current date/time selection.
                  </p>
                  <div className="mt-2 space-y-1">
                    {selectedVenueConflicts.slice(0, 3).map((window) => (
                      <p key={`conflict-${window.id || `${window.startTime}-${window.endTime}`}`} className="font-body text-[10px] text-neo-red/90">
                        {window.eventTitle || `Event #${window.eventId}`} | {formatWindowDateRange(window.startTime, window.endTime)} {formatWindowTime(window.startTime)} - {formatWindowTime(window.endTime)}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div>
            <label className="neo-label" htmlFor="event-banner-url">Banner Image URL</label>
            <input id="event-banner-url" {...register('bannerImageUrl')} className="neo-input" placeholder="https://..." />
            <div className="mt-3">
              <label className="neo-label" htmlFor="event-banner-upload">Or Upload Banner Image</label>
              <input
                id="event-banner-upload"
                type="file"
                accept="image/*"
                onChange={handleBannerFileChange}
                disabled={bannerUploading}
                className="neo-input"
              />
              <p className="text-xs text-neo-black/65 mt-1">
                {bannerUploading ? 'Uploading banner...' : 'Choose image, preview, then upload.'}
              </p>
              {bannerPreviewUrl ? (
                <div className="mt-3">
                  <p className="font-body text-[10px] uppercase tracking-wider text-neo-black/65 mb-2">Selected Preview</p>
                  <img
                    src={bannerPreviewUrl}
                    alt="Selected banner preview"
                    className="w-full max-h-56 object-cover rounded-lg border-2 border-neo-black"
                  />
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleBannerUpload}
                  disabled={bannerUploading || !bannerFile}
                  className="neo-btn neo-btn-sm bg-neo-white disabled:opacity-50"
                >
                  {bannerUploading ? 'Uploading...' : 'Upload Selected Image'}
                </button>
                <button
                  type="button"
                  onClick={clearBannerImage}
                  className="neo-btn neo-btn-sm bg-neo-white text-neo-red"
                >
                  Remove Current Image
                </button>
              </div>
            </div>
            {bannerImageUrl ? (
              <div className="mt-3">
                <img
                  src={bannerImageUrl}
                  alt="Event banner preview"
                  className="w-full max-h-56 object-cover rounded-lg border-2 border-neo-black"
                />
              </div>
            ) : null}
          </div>
          <div>
            <label className="neo-label" htmlFor="event-tags">Tags (comma-separated)</label>
            <input id="event-tags" {...register('tags')} className="neo-input" placeholder="outdoor, family, tech" />
          </div>
        </div>
        )}

        {/* Extracted sub-components */}
        {currentStep === 1 && (
        <TicketTierEditor
          control={control}
          register={register}
          errors={errors}
          capacityError={ticketCapacityError}
          totalCapacity={totalTicketTierCapacity}
          venueCapacity={selectedVenueCapacity}
        />
        )}
        {currentStep === 2 && (
        <div className="neo-card neo-card-no-hover neo-retroui-panel p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-3 border-neo-black/10 pb-3">
              <h2 className="font-heading text-sm uppercase tracking-wider">
                Schedule Management
              </h2>
              <div className="flex items-center gap-2">
                <span className="neo-badge bg-neo-cream">
                  {isEdit ? `${persistedSchedule.length} Saved Slots` : `${draftScheduleSlots.length} Draft Slots`}
                </span>
                {(editingPersistedSlotId || editingDraftSlotIndex !== null) && <span className="neo-badge bg-neo-yellow">Editing Slot</span>}
              </div>
            </div>
            <p className="font-body text-xs text-neo-black/70">
              {isEdit
                ? 'Create, update, and delete schedule slots directly through schedule endpoints.'
                : 'Add schedule slots now. They will be created for each new event after save.'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="neo-label" htmlFor="persisted-slot-title">Session Title</label>
                <input
                  id="persisted-slot-title"
                  value={slotDraft.sessionTitle}
                  onChange={(e) => setSlotDraft((s) => ({ ...s, sessionTitle: e.target.value }))}
                  className="neo-input"
                  placeholder="Session title"
                />
              </div>
              <div>
                <label className="neo-label" htmlFor="persisted-slot-date">Session Date</label>
                <input
                  id="persisted-slot-date"
                  type="date"
                  value={slotDraft.sessionDate}
                  min={watchEventDate || undefined}
                  max={watchEndDate || watchEventDate || undefined}
                  onChange={(e) => setSlotDraft((s) => ({ ...s, sessionDate: e.target.value }))}
                  className="neo-input"
                />
              </div>
              <div>
                <label className="neo-label" htmlFor="persisted-slot-start">Start Time</label>
                <TimePicker
                  id="persisted-slot-start"
                  value={slotDraft.startTime}
                  onChange={(val) => setSlotDraft((s) => ({ ...s, startTime: val }))}
                />
              </div>
              <div>
                <label className="neo-label" htmlFor="persisted-slot-end">End Time</label>
                <TimePicker
                  id="persisted-slot-end"
                  value={slotDraft.endTime}
                  onChange={(val) => setSlotDraft((s) => ({ ...s, endTime: val }))}
                />
              </div>
              <div>
                <label className="neo-label" htmlFor="persisted-slot-speaker">Speaker</label>
                <input
                  id="persisted-slot-speaker"
                  value={slotDraft.speakerName}
                  onChange={(e) => setSlotDraft((s) => ({ ...s, speakerName: e.target.value }))}
                  className="neo-input"
                  placeholder="Speaker"
                />
              </div>
              <div>
                <label className="neo-label" htmlFor="persisted-slot-location">Location</label>
                <input
                  id="persisted-slot-location"
                  value={slotDraft.locationNote}
                  onChange={(e) => setSlotDraft((s) => ({ ...s, locationNote: e.target.value }))}
                  className="neo-input"
                  placeholder="Room / stage"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleScheduleSlotSave}
                disabled={isSlotMutating}
                className="neo-btn neo-btn-sm bg-neo-green"
              >
                {createSlotMutation.isPending || updateSlotMutation.isPending
                  ? 'Saving Slot...'
                  : (editingPersistedSlotId || editingDraftSlotIndex !== null)
                    ? 'Update Slot'
                    : 'Add Slot'}
              </button>
              <button
                type="button"
                onClick={clearScheduleDraftForm}
                className="neo-btn neo-btn-sm bg-neo-white"
              >
                {(editingPersistedSlotId || editingDraftSlotIndex !== null) ? 'Cancel Edit' : 'Clear Form'}
              </button>
            </div>

            <div className="space-y-2">
              {(isEdit ? persistedSchedule.length : draftScheduleSlots.length) === 0 ? (
                <p className="font-body text-xs text-neo-black/65">No schedule slots yet.</p>
              ) : (
                (isEdit ? persistedSchedule : draftScheduleSlots).map((slot, index) => (
                  <div key={slot.id || `draft-slot-${index}`} className="neo-card neo-card-no-hover neo-retroui-inset p-3 flex items-center justify-between">
                    <div>
                      <p className="font-heading text-xs uppercase tracking-wider">{slot.sessionTitle}</p>
                      <p className="font-body text-[10px] text-neo-black/65">
                        {slot.sessionDate || watchEventDate || '-'} | 
                        {slot.startTime || '-'} - {slot.endTime || '-'}
                        {slot.speakerName ? ` | ${slot.speakerName}` : ''}
                        {slot.locationNote ? ` | ${slot.locationNote}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (isEdit) {
                            setEditingPersistedSlotId(slot.id);
                            setEditingDraftSlotIndex(null);
                          } else {
                            setEditingDraftSlotIndex(index);
                            setEditingPersistedSlotId(null);
                          }
                          setSlotDraft({
                            sessionTitle: slot.sessionTitle || '',
                            sessionDate: slot.sessionDate || watchEventDate || '',
                            startTime: slot.startTime || '',
                            endTime: slot.endTime || '',
                            speakerName: slot.speakerName || '',
                            locationNote: slot.locationNote || '',
                          });
                        }}
                        className="neo-btn neo-btn-sm bg-neo-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isEdit) {
                            deleteSlotMutation.mutate(slot.id);
                          } else {
                            setDraftScheduleSlots((current) => current.filter((_, slotIndex) => slotIndex !== index));
                            if (editingDraftSlotIndex === index) {
                              clearScheduleDraftForm();
                            }
                          }
                        }}
                        disabled={isSlotMutating}
                        className="neo-btn neo-btn-sm bg-neo-white text-neo-red"
                      >
                        {isEdit && deleteSlotMutation.isPending ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {currentStep === 3 && (
        <div className="neo-card neo-card-no-hover neo-retroui-panel p-6 space-y-5">
          <h2 className="font-heading text-sm uppercase tracking-wider border-b-3 border-neo-black/10 pb-3">
            Review Event Details
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="neo-card neo-card-no-hover neo-retroui-inset p-4 space-y-2">
              <p className="font-heading text-[10px] uppercase tracking-wider text-neo-black/65">Basic Information</p>
              <p className="font-body text-sm"><strong>Title:</strong> {watchTitle || '-'}</p>
              <p className="font-body text-sm"><strong>Description:</strong> {watchDescriptionText || '-'}</p>
              <p className="font-body text-sm"><strong>Category:</strong> {watchCategory || '-'}</p>
              <p className="font-body text-sm"><strong>Start Date:</strong> {watchEventDate || '-'}</p>
              <p className="font-body text-sm"><strong>End Date:</strong> {watchEndDate || watchEventDate || '-'}</p>
              <p className="font-body text-sm"><strong>Start Time:</strong> {watchStartTime || '-'}</p>
              <p className="font-body text-sm"><strong>End Time:</strong> {watchEndTime || '-'}</p>
              <p className="font-body text-sm"><strong>Tags:</strong> {watchTags || 'None'}</p>
            </div>

            <div className="neo-card neo-card-no-hover neo-retroui-inset p-4 space-y-2">
              <p className="font-heading text-[10px] uppercase tracking-wider text-neo-black/65">Venue & Banner</p>
              <p className="font-body text-sm"><strong>Venue Mode:</strong> {watchVenueMode === 'eventzen' ? 'EventZen Venue' : watchVenueMode === 'own' ? 'Own Venue' : 'Online / No Venue'}</p>
              {watchVenueMode === 'eventzen' ? (
                <>
                  <p className="font-body text-sm"><strong>Venue:</strong> {selectedVenue?.name || 'Not selected'}</p>
                  <p className="font-body text-sm"><strong>Address:</strong> {selectedVenue?.address || '-'}</p>
                </>
              ) : null}
              {watchVenueMode === 'own' ? (
                <>
                  <p className="font-body text-sm"><strong>Own Venue Name:</strong> {watchOwnVenueName || '-'}</p>
                  <p className="font-body text-sm"><strong>Own Venue Address:</strong> {watchOwnVenueAddress || '-'}</p>
                </>
              ) : null}
              <p className="font-body text-sm"><strong>Banner URL:</strong> {bannerImageUrl || 'Not set'}</p>
              {bannerImageUrl ? (
                <img
                  src={bannerImageUrl}
                  alt="Review banner"
                  className="w-full max-h-40 object-cover rounded-lg border-2 border-neo-black mt-2"
                />
              ) : null}
            </div>
          </div>

          <div className="neo-card neo-card-no-hover neo-retroui-inset p-4">
            <p className="font-heading text-[10px] uppercase tracking-wider text-neo-black/65 mb-2">Ticket Tiers</p>
            {Array.isArray(watchTicketTiers) && watchTicketTiers.length > 0 ? (
              <div className="space-y-2">
                {watchTicketTiers.map((tier, index) => (
                  <div key={`review-tier-${index}`} className="neo-card neo-card-no-hover p-3">
                    <p className="font-heading text-xs uppercase tracking-wider">{tier?.name || `Tier ${index + 1}`}</p>
                    <p className="font-body text-xs text-neo-black/70 mt-1">
                      Price: {Number(tier?.price || 0)} {tier?.currency || 'INR'} | Capacity: {Number(tier?.capacity || 0)} | Max/Order: {Number(tier?.maxPerOrder || 1)}
                    </p>
                    {tier?.description ? <p className="font-body text-xs text-neo-black/70 mt-1">{tier.description}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-body text-xs text-neo-black/65">No ticket tiers added.</p>
            )}
          </div>

          <div className="neo-card neo-card-no-hover neo-retroui-inset p-4">
            <p className="font-heading text-[10px] uppercase tracking-wider text-neo-black/65 mb-2">Schedule Slots</p>
            {(isEdit ? persistedSchedule : draftScheduleSlots).length > 0 ? (
              <div className="space-y-2">
                {(isEdit ? persistedSchedule : draftScheduleSlots).map((slot, index) => (
                  <div key={`review-slot-${slot.id || index}`} className="neo-card neo-card-no-hover p-3">
                    <p className="font-heading text-xs uppercase tracking-wider">{slot.sessionTitle || `Session ${index + 1}`}</p>
                    <p className="font-body text-xs text-neo-black/70 mt-1">
                      {slot.sessionDate || '-'} | {slot.startTime || '-'} - {slot.endTime || '-'}
                    </p>
                    <p className="font-body text-xs text-neo-black/70 mt-1">
                      Speaker: {slot.speakerName || 'N/A'} | Location: {slot.locationNote || 'N/A'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-body text-xs text-neo-black/65">No schedule slots added yet.</p>
            )}
          </div>
        </div>
        )}

        {!isCancelledReadOnly && (
        <div className="flex flex-wrap gap-3">
          {currentStep > 0 && (
            <button
              type="button"
              onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
              className="neo-btn neo-btn-lg bg-neo-white"
            >
              Back
            </button>
          )}
          {currentStep < formSteps.length - 1 && (
            <button
              type="button"
              onClick={async () => {
                const canContinue = await validateCurrentStep();
                if (!canContinue) return;
                setCurrentStep((step) => Math.min(formSteps.length - 1, step + 1));
              }}
              className="neo-btn neo-btn-lg bg-neo-yellow"
            >
              Continue
            </button>
          )}
        </div>
        )}

        {/* Actions */}
        {currentStep === formSteps.length - 1 && !isCancelledReadOnly && (
        <div className="flex flex-wrap gap-4">
          {isEdit ? (
            <button type="button" onClick={handleSaveDraft} disabled={isSaving || selectedVenueHasConflict} className="neo-btn-primary neo-btn-lg disabled:opacity-50">
              {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSaving || selectedVenueHasConflict}
                className="neo-btn neo-btn-lg bg-neo-white disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Draft'}
              </button>
              {isVendor ? (
                <button
                  type="button"
                  onClick={handlePromptPublish}
                  disabled={isSaving || selectedVenueHasConflict}
                  className="neo-btn-primary neo-btn-lg disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving...' : 'Create Event'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreatePublish}
                  disabled={isSaving || selectedVenueHasConflict}
                  className="neo-btn-primary neo-btn-lg disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving...' : 'Create Event'}
                </button>
              )}
            </>
          )}
          {isEdit && eventData?.status === 'DRAFT' && (
            <button type="button" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}
              className="neo-btn neo-btn-lg bg-neo-green">
              {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
            </button>
          )}
        </div>
        )}
        {saveMutation.error && (
          <div className="neo-card p-3 border-3 border-neo-red bg-neo-red/10">
            <p className="font-body text-xs text-neo-red">
              {saveMutation.error?.response?.data?.message || saveMutation.error?.message || 'Could not save event.'}
            </p>
          </div>
        )}
      </form>

      <Drawer
        open={publishConfirmOpen && isVendor}
        onClose={() => {
          setPublishConfirmOpen(false);
          setPendingPublishData(null);
        }}
        title="Send For Admin Approval"
        description="Creating this event will send it for admin approval instead of saving as a draft."
        footer={(
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setPublishConfirmOpen(false);
                setPendingPublishData(null);
              }}
              className="neo-btn neo-btn-sm bg-neo-white"
            >
              Go Back
            </button>
            <button
              type="button"
              onClick={handleConfirmPublish}
              className="neo-btn neo-btn-sm bg-neo-yellow"
            >
              Publish
            </button>
          </div>
        )}
      />
    </div>
  );
}
