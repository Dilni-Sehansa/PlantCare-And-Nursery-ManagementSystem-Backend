import { Router } from "express";
import { upload } from "../middleware/upload";
import {savePlantImage,uploadPlantImage,} from "../controllers/plantImage.controller";
import {createPlant,getAllPlants,getPlantById,updatePlant,deletePlant,getLowStockPlants,
  updatePlantStock,} from "../controllers/plant.controller";
import { authenticate, adminOnly, optionalAuthenticate } from "../middleware/auth.middleware";
import { validateImageSignature } from "../middleware/file-signature";

const router = Router();

router.post(
  "/upload-image",
  authenticate,
  adminOnly,
  uploadPlantImage.single("image"),
  validateImageSignature, 
  savePlantImage
);
router.get("/", getAllPlants);
router.get("/low-stock", authenticate, adminOnly, getLowStockPlants);
router.get("/:id", optionalAuthenticate, getPlantById);
router.post("/", authenticate, adminOnly , upload.single("image"), validateImageSignature, createPlant);
router.patch("/:id", authenticate, adminOnly, upload.single("image"), validateImageSignature, updatePlant);
router.delete("/:id", authenticate, adminOnly ,deletePlant);
router.patch("/:id/stock", authenticate, adminOnly, updatePlantStock);

export default router;