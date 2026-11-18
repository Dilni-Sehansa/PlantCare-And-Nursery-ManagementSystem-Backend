import { Request, Response } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { supabase } from "../config/supabase";
import { imageExtensionFor } from "../middleware/file-signature";

const PLANT_IMAGES_BUCKET = "plant-images";
const storage = multer.memoryStorage();

export const uploadPlantImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export const storePlantImage = async (
  file: Express.Multer.File
): Promise<string> => {
  const fileExtension = imageExtensionFor(file.mimetype);

  if (!fileExtension) {
    throw new Error("Unsupported plant image type");
  }

  const filePath = `plants/${randomUUID()}${fileExtension}`;
  const { data, error } = await supabase.storage
    .from(PLANT_IMAGES_BUCKET)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error || !data) {
    throw error ?? new Error("Plant image upload returned no data");
  }

  const { data: publicUrl } = supabase.storage
    .from(PLANT_IMAGES_BUCKET)
    .getPublicUrl(data.path);

  return publicUrl.publicUrl;
};

export const savePlantImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please select an image",
      });
    }

    const imageUrl = await storePlantImage(req.file);

    return res.status(200).json({
      message: "Image uploaded successfully",
      imageUrl,
    });
  } catch (error) {
    console.error("Plant Image Upload Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
