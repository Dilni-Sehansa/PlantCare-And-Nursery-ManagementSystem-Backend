import { Schema, Document, model } from "mongoose";

export enum PlantCategory {
  INDOOR = "Indoor",
  OUTDOOR = "Outdoor",
  INDOOR_OUTDOOR = "Indoor & Outdoor",
}

export enum Sunlight {
  FULL = "Full",
  INDIRECT = "Indirect",
  LOW = "Low",
}

export enum WaterNeed {
  LOW = "Low",
  MEDIUM = "Medium",
  HIGH = "High",
}

export interface IPlant extends Document {
  plantId: string;
  name: string;
  description: string;
  category: PlantCategory[];
  plantType: string;
  waterNeed: WaterNeed;
  sunlight: Sunlight;
  price: number;
  stock: number;
  image: string;
  careTips: string;
}

const plantSchema = new Schema<IPlant>(
  {
    plantId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    category: {
      type: [String],
      enum: Object.values(PlantCategory),
      required: true,
      validate: {
        validator: (value: PlantCategory[]) =>
          Array.isArray(value) &&
          value.length === 1 &&
          Object.values(PlantCategory).includes(value[0]) &&
          new Set(value).size === value.length,
        message: "Select exactly one valid category",
      },
    },

    plantType: {
      type: String,
      required: true,
      trim: true,
    },

    waterNeed: {
      type: String,
      enum: Object.values(WaterNeed),
      required: true,
    },

    sunlight: {
      type: String,
      enum: Object.values(Sunlight),
      required: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    stock: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value: number) => Number.isInteger(value),
        message: "Stock must be a whole number",
      },
    },

    image: {
      type: String,
      default: "",
      trim: true,
    },

    careTips: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

export const PlantModel = model<IPlant>("system_plants", plantSchema);