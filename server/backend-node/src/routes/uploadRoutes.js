import { Router } from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import { Client as MinioClient } from 'minio';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const MAX_FILE_SIZE_BYTES = Number(process.env.UPLOAD_MAX_FILE_SIZE_BYTES || 15 * 1024 * 1024);
const ALLOWED_FOLDERS = new Set(['eventzen/avatars', 'eventzen/events']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

function singleImageUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: `Image must be ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB or smaller.`,
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid upload payload.',
    });
  });
}

function parseMinioEndpoint(raw) {
  const value = String(raw || '').trim();
  if (!value) return { endPoint: 'minio', port: 9000, useSSL: false };

  if (value.startsWith('http://') || value.startsWith('https://')) {
    const url = new URL(value);
    return {
      endPoint: url.hostname,
      port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
      useSSL: url.protocol === 'https:',
    };
  }

  const [host, port] = value.split(':');
  return {
    endPoint: host,
    port: Number(port || 9000),
    useSSL: false,
  };
}

function parsePublicBaseUrl(raw) {
  const candidate = String(raw || '').trim() || 'http://localhost:8080/media';
  try {
    const parsed = new URL(candidate);
    return parsed.toString().replace(/\/$/, '');
  } catch {
    throw new Error('MINIO_PUBLIC_BASE_URL must be a valid absolute URL.');
  }
}

const minioEndpoint = parseMinioEndpoint(process.env.MINIO_ENDPOINT || 'minio:9000');
const minioBucket = String(process.env.MINIO_BUCKET || 'eventzen-media').trim();
const minioPublicBaseUrl = parsePublicBaseUrl(process.env.MINIO_PUBLIC_BASE_URL);
const minioClient = new MinioClient({
  endPoint: minioEndpoint.endPoint,
  port: minioEndpoint.port,
  useSSL: minioEndpoint.useSSL,
  accessKey: String(process.env.MINIO_ACCESS_KEY || 'minioadmin'),
  secretKey: String(process.env.MINIO_SECRET_KEY || 'minioadmin'),
});

let bucketReadyPromise = null;

async function ensureBucketReady() {
  if (!minioBucket) {
    throw new Error('MINIO_BUCKET is not configured.');
  }

  if (!bucketReadyPromise) {
    bucketReadyPromise = (async () => {
      const exists = await minioClient.bucketExists(minioBucket);
      if (!exists) {
        await minioClient.makeBucket(minioBucket, 'us-east-1');
      }

      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${minioBucket}/*`],
          },
        ],
      };

      await minioClient.setBucketPolicy(minioBucket, JSON.stringify(policy));
    })().catch((err) => {
      bucketReadyPromise = null;
      throw err;
    });
  }

  await bucketReadyPromise;
}

function sanitizeFolder(inputFolder) {
  const value = String(inputFolder || '').trim();
  if (!value) return '';
  return value
    .split('/')
    .map((segment) => segment.replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(Boolean)
    .join('/');
}

function validateFolder(folder) {
  if (!folder) return true;
  return ALLOWED_FOLDERS.has(folder);
}

function getObjectName(fileName, folder) {
  const extension = String(fileName || '').split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
  const key = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  return folder ? `${folder}/${key}` : key;
}

async function normalizeImageUpload(file) {
  const mimetype = String(file?.mimetype || '').toLowerCase();
  const originalName = String(file?.originalname || 'image').trim() || 'image';
  const convertable = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif', 'image/tiff'].includes(mimetype);

  if (!convertable) {
    return {
      buffer: file.buffer,
      size: file.size,
      mimetype,
      originalname: originalName,
      normalized: false,
    };
  }

  try {
    const buffer = await sharp(file.buffer)
      .rotate()
      .webp({ quality: 82, effort: 5 })
      .toBuffer();

    const nameWithoutExt = originalName.replace(/\.[^.]+$/, '') || 'image';

    return {
      buffer,
      size: buffer.length,
      mimetype: 'image/webp',
      originalname: `${nameWithoutExt}.webp`,
      normalized: true,
    };
  } catch {
    return {
      buffer: file.buffer,
      size: file.size,
      mimetype,
      originalname: originalName,
      normalized: false,
    };
  }
}

function buildPublicUrl(objectName) {
  return `${minioPublicBaseUrl}/${encodeURIComponent(minioBucket)}/${objectName
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}

function extractObjectNameFromUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;

  try {
    const fallbackBase = minioPublicBaseUrl.startsWith('http') ? minioPublicBaseUrl : 'http://localhost:8080';
    const parsed = imageUrl.startsWith('http://') || imageUrl.startsWith('https://')
      ? new URL(imageUrl)
      : new URL(imageUrl, fallbackBase);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;

    const mediaIdx = parts[0] === 'media' ? 1 : 0;
    const bucket = decodeURIComponent(parts[mediaIdx] || '');
    if (bucket !== minioBucket) return null;
    const keyParts = parts.slice(mediaIdx + 1).map((p) => decodeURIComponent(p));
    const objectName = keyParts.join('/');
    return objectName || null;
  } catch {
    return null;
  }
}
router.get('/config', async (req, res) => {
  try {
    await ensureBucketReady();
    return res.json({
      bucket: minioBucket,
      publicBaseUrl: minioPublicBaseUrl,
      maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
    });
  } catch {
    return res.status(503).json({
      message: 'Media uploads are not configured on this environment.',
    });
  }
});

router.post('/image', authenticate, singleImageUpload, async (req, res) => {
  const file = req.file;
  const folder = sanitizeFolder(req.body?.folder);

  if (!file) {
    return res.status(400).json({ success: false, message: 'Image file is required.' });
  }

  if (!String(file.mimetype || '').startsWith('image/')) {
    return res.status(400).json({ success: false, message: 'Only image files are supported.' });
  }

  if (!validateFolder(folder)) {
    return res.status(400).json({ success: false, message: 'Unsupported upload folder.' });
  }

  try {
    await ensureBucketReady();
    const normalizedUpload = await normalizeImageUpload(file);

    const objectName = getObjectName(normalizedUpload.originalname, folder);
    await minioClient.putObject(minioBucket, objectName, normalizedUpload.buffer, normalizedUpload.size, {
      'Content-Type': normalizedUpload.mimetype,
    });

    return res.status(201).json({
      success: true,
      data: {
        imageUrl: buildPublicUrl(objectName),
        objectName,
        folder,
        bucket: minioBucket,
      },
    });
  } catch {
    return res.status(502).json({ success: false, message: 'Image upload failed.' });
  }
});

router.delete('/delete', authenticate, async (req, res) => {
  const explicitObjectName = String(req.body?.objectName || '').trim();
  const imageUrl = String(req.body?.imageUrl || '').trim();
  const objectName = explicitObjectName || extractObjectNameFromUrl(imageUrl);
  if (!objectName) {
    return res.status(400).json({ success: false, message: 'objectName or valid MinIO imageUrl is required.' });
  }

  try {
    await ensureBucketReady();
    await minioClient.removeObject(minioBucket, objectName);

    return res.json({
      success: true,
      data: {
        result: 'deleted',
        objectName,
      },
    });
  } catch {
    return res.status(502).json({ success: false, message: 'Could not delete image from MinIO.' });
  }
});

export default router;
