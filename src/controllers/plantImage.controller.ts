import { Request, Response } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { supabase } from "../config/supabase";

const PLANT_IMAGES_BUCKET = "plant-images";
const storage = multer.memoryStorage();

export const uploadPlantImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      return callback(new Error("Only image files are allowed"));
    }

    callback(null, true);
  },
});

export const savePlantImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please select an image",
      });
    }

    const fileExtension =
      req.file.originalname.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `plants/${randomUUID()}.${fileExtension}`;

    const { error } = await supabase.storage
      .from(PLANT_IMAGES_BUCKET)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error("Supabase Plant Image Upload Error:", error);

      return res.status(500).json({
        message: "Image upload failed",
      });
    }

    const { data } = supabase.storage
      .from(PLANT_IMAGES_BUCKET)
      .getPublicUrl(filePath);

    return res.status(200).json({
      message: "Image uploaded successfully",
      imageUrl: data.publicUrl,
    });
  } catch (error) {
    console.error("Plant Image Upload Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
