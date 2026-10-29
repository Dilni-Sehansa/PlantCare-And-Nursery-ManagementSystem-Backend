
import { Router, Request, Response } from "express";
import PlantTypeModel from "../models/plantType.model";
import { PlantCategory } from "../models/plant.model";

const router = Router();

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.get("/", async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const filter: Record<string, unknown> = {};

    if (category) {
      if (
        !Object.values(PlantCategory).includes(
          category as PlantCategory
        )
      ) {
        return res.status(400).json({
          message: "Invalid main category",
        });
      }

      filter.categories = category;
    }

    const plantTypes = await PlantTypeModel.find(filter)
      .sort({ name: 1 });

    return res.status(200).json({
      message: "Plant types retrieved successfully",
      data: plantTypes,
    });
  } catch (error) {
    console.error("Get Plant Types Error:", error);

    return res.status(500).json({
      message: "Failed to get plant types",
    });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, categories } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      !Array.isArray(categories) ||
      categories.length === 0
    ) {
      return res.status(400).json({
        message: "Name and categories are required",
      });
    }
    const validCategories = Object.values(PlantCategory);

    if (
      categories.some(
        (category: unknown) =>
          typeof category !== "string" ||
          !validCategories.includes(category as PlantCategory)
      )
    ) {
      return res.status(400).json({
        message: "Select valid categories",
      });
    }

    const uniqueCategories = [
        ...new Set(categories),
    ] as PlantCategory[];

    if (uniqueCategories.length !== categories.length) {
      return res.status(400).json({
        message: "Duplicate categories are not allowed",
      });
    }

    const normalizedName = name.trim();

    const existingTypes = await PlantTypeModel.find({
      name: {
        $regex: `^${escapeRegex(normalizedName)}$`,
        $options: "i",
      },
    });

    const sortedNewCategories = [...uniqueCategories].sort();

    const duplicate = existingTypes.some((item) => {
      const existingCategories = [...item.categories].sort();

      return (
        existingCategories.length === sortedNewCategories.length &&
        existingCategories.every(
          (value, index) => value === sortedNewCategories[index]
        )
      );
    });

    if (duplicate) {
      return res.status(409).json({
        message: "This plant type already exists for these categories",
      });
    }

    const plantType = await PlantTypeModel.create({
      name: normalizedName,
      categories: uniqueCategories,
    });

    return res.status(201).json({
      message: "Plant type added successfully",
      data: plantType,
    });
  } catch (error) {
    console.error("Create Plant Type Error:", error);

    return res.status(500).json({
      message: "Failed to create plant type",
    });
  }
});

export default router;
