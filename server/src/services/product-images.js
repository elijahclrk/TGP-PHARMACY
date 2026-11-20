import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { imageFailure } from '../repositories/product-images.repository.js';

export const maxImageBytes = 5 * 1024 * 1024;
export const imagePrefix = 'tgp/product-images/';
export const validImageId = value => typeof value === 'string' && /^tgp\/product-images\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);

export async function normalizeProductImage(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > maxImageBytes) throw imageFailure(400);
  const png = buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (!png && !jpeg) throw imageFailure(400);
  if (png) {
    for (let offset = 8; offset + 12 <= buffer.length;) {
      const size = buffer.readUInt32BE(offset);
      if (size > buffer.length - offset - 12) throw imageFailure(400);
      if (buffer.toString('ascii',offset + 4,offset + 8) === 'acTL') throw imageFailure(400);
      offset += size + 12;
    }
  }
  try {
    const image = sharp(buffer, { failOn: 'warning', limitInputPixels: 16000000, animated: true });
    const meta = await image.metadata();
    if (!['jpeg','png'].includes(meta.format) || (meta.pages ?? 1) !== 1 || !meta.width || !meta.height ||
      meta.width > 4096 || meta.height > 4096 || meta.width * meta.height > 16000000) throw imageFailure(400);
    // Full decode/re-encode strips original metadata and embedded payloads.
    const output = await image.rotate().jpeg({ quality: 85 }).timeout({ seconds: 5 }).toBuffer();
    if (output.length > maxImageBytes) throw imageFailure(400);
    return output;
  } catch { throw imageFailure(400); }
}

export function createImageProvider(environment = process.env) {
  const options = {
    cloud_name: environment.CLOUDINARY_CLOUD_NAME,
    api_key: environment.CLOUDINARY_API_KEY,
    api_secret: environment.CLOUDINARY_API_SECRET,
    secure: true, timeout: 15000,
  };
  // Explicit opt-in acknowledges public delivery of non-sensitive package images.
  const enabled = environment.PRODUCT_IMAGES_ENABLED === 'true' &&
    /^[a-z0-9_-]+$/i.test(options.cloud_name ?? '') && Boolean(options.api_key && options.api_secret);
  return {
    enabled,
    url(id) {
      if (!enabled || !validImageId(id)) return null;
      return cloudinary.url(id, { cloud_name: options.cloud_name, secure: true,
        transformation: [{ width: 160, height: 160, crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }] });
    },
    async upload(buffer, id) {
      if (!enabled || !validImageId(id)) throw imageFailure(503);
      try {
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream({ ...options, resource_type: 'image', type: 'upload',
            public_id: id, overwrite: false }, (error, data) => error ? reject(error) : resolve(data)).end(buffer);
        });
        if (result.public_id !== id || result.resource_type !== 'image') throw imageFailure(502);
      } catch { throw imageFailure(502); }
    },
    async remove(id) {
      if (!enabled || !validImageId(id)) throw imageFailure(503);
      try {
        const result = await cloudinary.uploader.destroy(id, { ...options, resource_type: 'image', type: 'upload', invalidate: true });
        if (!['ok', 'not found'].includes(result.result)) throw imageFailure(502);
      } catch { throw imageFailure(502); }
    },
  };
}
