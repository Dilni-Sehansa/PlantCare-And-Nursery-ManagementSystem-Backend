
import { RequestHandler } from "express";
import fs from "node:fs/promises";
import path from "node:path";

const imageSignatures: Array<{
  mimeType: string;
  extension: string;
  matches: (buffer: Buffer) => boolean;
}> = [
  {
    mimeType: "image/jpeg",
    extension: ".jpg",
    matches: (buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  {
    mimeType: "image/png",
    extension: ".png",
    matches: (buffer) =>
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      ),
  },
  {
    mimeType: "image/webp",
    extension: ".webp",
    matches: (buffer) =>
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP",
  },
];

const normalizeMimeType = (mimeType: string) =>
  mimeType.toLowerCase() === "image/jpg"
    ? "image/jpeg"
    : mimeType.toLowerCase();

export const isSupportedImageMimeType = (mimeType: string) =>
  imageSignatures.some(
    (signature) => signature.mimeType === normalizeMimeType(mimeType)
  );

export const detectImageMimeType = (
  buffer: Buffer
): string | undefined =>
  imageSignatures.find((signature) => signature.matches(buffer))?.mimeType;

export const imageExtensionFor = (mimeType: string) =>
  imageSignatures.find(
    (signature) => signature.mimeType === mimeType
  )?.extension;

const rejectAndRemoveFile = async (
  file: Express.Multer.File
) => {
  if (file.path) {
    await fs.unlink(file.path).catch(() => undefined);
  }
};

export const validateImageSignature: RequestHandler = async (
  req,
  res,
  next
) => {
  const file = req.file;

  if (!file) {
    return next();
  }

  try {
    const buffer =
      file.buffer ??
      (file.path ? await fs.readFile(file.path) : undefined);

    const detectedMimeType = buffer
      ? detectImageMimeType(buffer)
      : undefined;

    if (
      !buffer ||
      !isSupportedImageMimeType(file.mimetype) ||
      !detectedMimeType ||
      normalizeMimeType(file.mimetype) !== detectedMimeType
    ) {
      await rejectAndRemoveFile(file);

      return res.status(400).json({
        success: false,
        message:
          "Image must be a PNG, JPEG or WebP file whose contents match its declared type",
      });
    }

    file.mimetype = detectedMimeType;

    if (file.path) {
      const extension = imageExtensionFor(detectedMimeType)!;
      const correctedPath = path.join(
        path.dirname(file.path),
        `${path.basename(file.path, path.extname(file.path))}${extension}`
      );

      if (path.extname(file.path).toLowerCase() !== extension) {
        await fs.rename(file.path, correctedPath);
        file.path = correctedPath;
        file.filename = path.basename(correctedPath);
      }
    }

    return next();
  } catch (error) {
    await rejectAndRemoveFile(file);
    return next(error);
  }
};

export const validatePaymentSlipSignature: RequestHandler = async (
  req,
  res,
  next
) => {
  const file = req.file;

  if (!file) {
    return next();
  }

  try {
    const buffer =
      file.buffer ??
      (file.path ? await fs.readFile(file.path) : undefined);

    if (!buffer) {
      await rejectAndRemoveFile(file);

      return res.status(400).json({
        success: false,
        message: "Could not read payment slip",
      });
    }

    const detectedImageMimeType = detectImageMimeType(buffer);

    const isPdf =
      buffer.length >= 5 &&
      buffer.toString("ascii", 0, 5) === "%PDF-";

    const detectedMimeType = isPdf
      ? "application/pdf"
      : detectedImageMimeType;

    const declaredMimeType = normalizeMimeType(file.mimetype);

    if (
      !detectedMimeType ||
      declaredMimeType !== detectedMimeType ||
      !["image/jpeg", "image/png", "application/pdf"].includes(
        detectedMimeType
      )
    ) {
      await rejectAndRemoveFile(file);

      return res.status(400).json({
        success: false,
        message:
          "Payment slip content must match a JPG, PNG or PDF file",
      });
    }

    file.mimetype = detectedMimeType;

    return next();
  } catch (error) {
    await rejectAndRemoveFile(file);
    return next(error);
  }
};
