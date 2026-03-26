import { uploadsApi } from '@/shared/api';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

async function getMediaConfig() {
  const response = await uploadsApi.getConfig();
  const payload = response?.data?.data || response?.data || {};

  if (!payload?.bucket || !payload?.publicBaseUrl) {
    throw new Error('Media uploads are not configured.');
  }

  return payload;
}

export async function uploadImageToMinio(file, { folder } = {}) {
  if (!(file instanceof File)) {
    throw new Error('Please choose a valid image file.');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are supported.');
  }

  const mediaConfig = await getMediaConfig();
  const maxSizeBytes = Number(mediaConfig?.maxFileSizeBytes || MAX_IMAGE_SIZE_BYTES);
  if (file.size > maxSizeBytes) {
    throw new Error(`Image must be ${Math.floor(maxSizeBytes / (1024 * 1024))}MB or smaller.`);
  }

  const formData = new FormData();
  formData.append('file', file);
  if (folder) formData.append('folder', folder);

  const response = await uploadsApi.uploadImage(formData);
  const payload = response?.data?.data || response?.data || {};
  const imageUrl = payload?.imageUrl;
  const objectName = payload?.objectName;
  if (!imageUrl || !objectName) {
    throw new Error('Image upload failed.');
  }

  return {
    imageUrl,
    objectName,
    bucket: payload?.bucket || null,
  };
}

export async function deleteImageFromMinio({ imageUrl, objectName } = {}) {
  const payload = {};
  if (objectName) payload.objectName = String(objectName).trim();
  if (imageUrl) payload.imageUrl = String(imageUrl).trim();

  if (!payload.objectName && !payload.imageUrl) return;
  await uploadsApi.deleteByUrl(payload);
}
