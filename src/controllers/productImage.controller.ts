
import { Request, Response } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { supabase, SUPABASE_BUCKET } from "../config/supabase";
import { imageExtensionFor } from "../middleware/file-signature";

const storage = multer.memoryStorage();

export const uploadProductImage = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

export const saveProductImage = async (
    req: Request,
    res: Response
) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "Please select an image",
            });
        }

        const fileExtension = imageExtensionFor(req.file.mimetype) || ".jpg";
        const filePath = `products/${randomUUID()}${fileExtension}`;
        const { error } = await supabase.storage
            .from(SUPABASE_BUCKET)
            .upload(filePath, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false,
            });

        if (error) {
            console.error("Supabase Upload Error:", error);

            return res.status(500).json({
                message: "Image upload failed",
            });
        }

        const { data } = supabase.storage
            .from(SUPABASE_BUCKET)
            .getPublicUrl(filePath);

        return res.status(200).json({
            message: "Image uploaded successfully",
            imageUrl: data.publicUrl,
        });
    } catch (error) {
        console.error("Product Image Upload Error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
};
