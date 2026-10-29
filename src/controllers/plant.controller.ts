import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import {PlantModel,PlantCategory,WaterNeed,Sunlight,} from "../models/plant.model";
import PlantTypeModel from "../models/plantType.model";

const escapeRegex = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const isPlantCategory = (value: unknown) => {
  return (
    typeof value === "string" &&
    Object.values(PlantCategory).includes(value as PlantCategory)
  );
};

const findPlantType = async (plantType: string, category: PlantCategory) => {
  const escapedName = escapeRegex(plantType.trim());

  return PlantTypeModel.findOne({
    name: {
      $regex: `^${escapedName}$`,
      $options: "i",
    },
    categories: { $in: [category] },
  });
};

const generatePlantId = async () => {
  const lastPlant = await PlantModel.findOne()
    .sort({ createdAt: -1 })
    .select("plantId");

  let nextNumber = 1;

  if (lastPlant && lastPlant.plantId) {
    const match = lastPlant.plantId.match(/P(\d+)/i);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `P${String(nextNumber).padStart(3, "0")}`;
};

// save
export const createPlant = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      category,
      plantType,
      waterNeed,
      sunlight,
      price,
      stock,
      careTips,
    } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof plantType !== "string" ||
      !plantType.trim()
    ) {
      return res.status(400).json({
        message: "Plant name and plant type are required",
      });
    }

    if (!isPlantCategory(category)) {
      return res.status(400).json({
        message: "Select one valid category",
      });
    }

    if (!Object.values(WaterNeed).includes(waterNeed as WaterNeed)) {
      return res.status(400).json({
        message: "Invalid water need",
      });
    }

    if (!Object.values(Sunlight).includes(sunlight as Sunlight)) {
      return res.status(400).json({
        message: "Invalid sunlight",
      });
    }

    if (
      price === undefined ||
      price === null ||
      String(price).trim() === "" ||
      stock === undefined ||
      stock === null ||
      String(stock).trim() === ""
    ) {
      return res.status(400).json({
        message: "Price and stock are required",
      });
    }

    const parsedPrice = Number(price);
    const parsedStock = Number(stock);

    if (
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0 ||
      !Number.isInteger(parsedStock) ||
      parsedStock < 0
    ) {
      return res.status(400).json({
        message: "Enter a valid price and whole-number stock",
      });
    }

    const plantTypeDocument = await findPlantType(plantType, category);

    if (!plantTypeDocument) {
      return res.status(400).json({
        message: "Plant type does not belong to the selected category",
      });
    }

    const plantId = await generatePlantId();
    const image = req.file ? `/uploads/${req.file.filename}` : "";

    const plant = await PlantModel.create({
      plantId,
      name: name.trim(),
      description: typeof description === "string" ? description.trim() : "",
      category: [category],
      plantType: plantTypeDocument.name,
      waterNeed,
      sunlight,
      price: parsedPrice,
      stock: parsedStock,
      image,
      careTips: typeof careTips === "string" ? careTips.trim() : "",
    });

    return res.status(201).json({
      message: "Plant Save successfully!",
      data: plant,
    });
  } catch (error: any) {
    console.error("Save Plant Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Plant ID already exists. Please try again...",
      });
    }

    return res.status(500).json({
      message: "Failed to save plant",
    });
  }
};

// getAll
export const getAllPlants = async (req: Request, res: Response) => {
  try {
    const page = Math.max(
      1,
      Number.parseInt(String(req.query.page ?? "1"), 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(String(req.query.limit ?? "10"), 10) || 10)
    );

    const skip = (page - 1) * limit;
    const filter: any = {};

    const {
      category,
      plantType,
      waterNeed,
      sunlight,
      minPrice,
      maxPrice,
      search,
      plantId,
    } = req.query;

    if (plantId !== undefined) {
      if (typeof plantId !== "string" || !plantId.trim()) {
        return res.status(400).json({
          message: "Invalid plant ID filter",
        });
      }
      filter.plantId = plantId.trim().toUpperCase();
    }

    if (category !== undefined) {
      if (!isPlantCategory(category)) {
        return res.status(400).json({
          message: "Invalid category filter",
        });
      }
      filter.category = category;
    }

    if (plantType !== undefined) {
      if (typeof plantType !== "string" || !plantType.trim()) {
        return res.status(400).json({
          message: "Invalid plant type filter",
        });
      }
      filter.plantType = {
        $regex: escapeRegex(plantType.trim()),
        $options: "i",
      };
    }

    if (waterNeed !== undefined) {
      if (
        typeof waterNeed !== "string" ||
        !Object.values(WaterNeed).includes(waterNeed as WaterNeed)
      ) {
        return res.status(400).json({
          message: "Invalid water need filter",
        });
      }
      filter.waterNeed = waterNeed;
    }

    if (sunlight !== undefined) {
      if (
        typeof sunlight !== "string" ||
        !Object.values(Sunlight).includes(sunlight as Sunlight)
      ) {
        return res.status(400).json({
          message: "Invalid sunlight filter",
        });
      }
      filter.sunlight = sunlight;
    }

    const priceFilter: any = {};

    if (minPrice !== undefined) {
      const minimum = Number(minPrice);
      if (
        String(minPrice).trim() === "" ||
        !Number.isFinite(minimum) ||
        minimum < 0
      ) {
        return res.status(400).json({
          message: "Invalid minimum price",
        });
      }
      priceFilter.$gte = minimum;
    }

    if (maxPrice !== undefined) {
      const maximum = Number(maxPrice);
      if (
        String(maxPrice).trim() === "" ||
        !Number.isFinite(maximum) ||
        maximum < 0
      ) {
        return res.status(400).json({
          message: "Invalid maximum price",
        });
      }
      priceFilter.$lte = maximum;
    }

    if (
      priceFilter.$gte !== undefined &&
      priceFilter.$lte !== undefined &&
      priceFilter.$gte > priceFilter.$lte
    ) {
      return res.status(400).json({
        message: "Minimum price cannot exceed maximum price",
      });
    }

    if (Object.keys(priceFilter).length > 0) {
      filter.price = priceFilter;
    }

    if (search !== undefined) {
      if (typeof search !== "string") {
        return res.status(400).json({
          message: "Invalid search value",
        });
      }
      if (search.trim()) {
        filter.name = {
          $regex: escapeRegex(search.trim()),
          $options: "i",
        };
      }
    }

    const plants = await PlantModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await PlantModel.countDocuments(filter);

    return res.status(200).json({
      message: "Plants retrieved successfully!",
      data: plants,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get Plants Error:", error);
    return res.status(500).json({
      message: "Failed to get plants",
    });
  }
};

// filter
export const getPlantById = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;

    if (typeof rawId !== "string" || !rawId.trim()) {
      return res.status(400).json({
        message: "Invalid plant ID",
      });
    }

    const id = rawId.trim().toUpperCase();

    let plant = await PlantModel.findOne({ plantId: id });

    if (!plant && isValidObjectId(rawId.trim())) {
      plant = await PlantModel.findById(rawId.trim());
    }

    if (!plant) {
      return res.status(404).json({
        message: "Plant not found",
      });
    }

    return res.status(200).json({
      message: "Plant retrieved successfully",
      data: plant,
    });
  } catch (error) {
    console.error("Get Plant Error:", error);
    return res.status(500).json({
      message: "Failed to get plant",
    });
  }
};

// update
export const updatePlant = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;

    if (typeof rawId !== "string" || !rawId.trim()) {
      return res.status(400).json({
        message: "Invalid plant ID",
      });
    }

    const id = rawId.trim().toUpperCase();

    let plant = await PlantModel.findOne({ plantId: id });

    if (!plant && isValidObjectId(rawId.trim())) {
      plant = await PlantModel.findById(rawId.trim());
    }

    if (!plant) {
      return res.status(404).json({
        message: "Plant not found",
      });
    }

    const {
      name,
      description,
      category,
      plantType,
      waterNeed,
      sunlight,
      price,
      stock,
      careTips,
    } = req.body;

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          message: "Plant name cannot be empty",
        });
      }
      plant.name = name.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string") {
        return res.status(400).json({
          message: "Invalid description",
        });
      }
      plant.description = description.trim();
    }

    let selectedCategory = plant.category[0];

    if (category !== undefined) {
      if (!isPlantCategory(category)) {
        return res.status(400).json({
          message: "Select one valid category",
        });
      }
      selectedCategory = category;
    }

    const selectedPlantType =
      plantType === undefined ? plant.plantType : plantType;

    if (typeof selectedPlantType !== "string" || !selectedPlantType.trim()) {
      return res.status(400).json({
        message: "Invalid plant type",
      });
    }

    if (category !== undefined || plantType !== undefined) {
      const plantTypeDocument = await findPlantType(
        selectedPlantType,
        selectedCategory
      );

      if (!plantTypeDocument) {
        return res.status(400).json({
          message: "Plant type does not belong to the selected category",
        });
      }

      plant.category = [selectedCategory];
      plant.plantType = plantTypeDocument.name;
    }

    if (waterNeed !== undefined) {
      if (
        typeof waterNeed !== "string" ||
        !Object.values(WaterNeed).includes(waterNeed as WaterNeed)
      ) {
        return res.status(400).json({
          message: "Invalid water need",
        });
      }
      plant.waterNeed = waterNeed as WaterNeed;
    }

    if (sunlight !== undefined) {
      if (
        typeof sunlight !== "string" ||
        !Object.values(Sunlight).includes(sunlight as Sunlight)
      ) {
        return res.status(400).json({
          message: "Invalid sunlight",
        });
      }
      plant.sunlight = sunlight as Sunlight;
    }

    if (price !== undefined) {
      if (String(price).trim() === "") {
        return res.status(400).json({
          message: "Invalid price",
        });
      }
      const parsedPrice = Number(price);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({
          message: "Price must be zero or greater",
        });
      }
      plant.price = parsedPrice;
    }

    if (stock !== undefined) {
      if (String(stock).trim() === "") {
        return res.status(400).json({
          message: "Invalid stock",
        });
      }
      const parsedStock = Number(stock);
      if (!Number.isInteger(parsedStock) || parsedStock < 0) {
        return res.status(400).json({
          message: "Stock must be a whole number greater than or equal to zero",
        });
      }
      plant.stock = parsedStock;
    }

    if (careTips !== undefined) {
      if (typeof careTips !== "string") {
        return res.status(400).json({
          message: "Invalid care tips",
        });
      }
      plant.careTips = careTips.trim();
    }

    if (req.file) {
      plant.image = `/uploads/${req.file.filename}`;
    }

    await plant.save();

    return res.status(200).json({
      message: "Plant updated successfully",
      data: plant,
    });
  } catch (error) {
    console.error("Update Plant Error:", error);
    return res.status(500).json({
      message: "Failed to update plant",
    });
  }
};

// delete
export const deletePlant = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;

    if (typeof rawId !== "string" || !rawId.trim()) {
      return res.status(400).json({
        message: "Invalid plant ID",
      });
    }

    const id = rawId.trim().toUpperCase();

    let plant = await PlantModel.findOneAndDelete({ plantId: id });

    if (!plant && isValidObjectId(rawId.trim())) {
      plant = await PlantModel.findByIdAndDelete(rawId.trim());
    }

    if (!plant) {
      return res.status(404).json({
        message: "Plant not found",
      });
    }

    return res.status(200).json({
      message: "Plant deleted successfully",
      data: plant,
    });
  } catch (error) {
    console.error("Delete Plant Error:", error);
    return res.status(500).json({
      message: "Failed to delete plant",
    });
  }
};