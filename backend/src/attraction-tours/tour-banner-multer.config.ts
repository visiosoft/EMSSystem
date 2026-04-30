import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { join } from 'path';

export const TOUR_BANNER_UPLOAD_DIR = join(
  process.cwd(),
  'uploads',
  'tour-banners',
);

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export function tourBannerMulterOptions() {
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, TOUR_BANNER_UPLOAD_DIR);
      },
      filename: (_req, file, cb) => {
        const mime = (file.mimetype || '').toLowerCase();
        const ext = MIME_EXT[mime] ?? '.jpg';
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      if (/^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype)) {
        cb(null, true);
      } else {
        cb(
          new BadRequestException(
            'Only JPEG, PNG, WebP, or GIF images are allowed.',
          ),
          false,
        );
      }
    },
  };
}
