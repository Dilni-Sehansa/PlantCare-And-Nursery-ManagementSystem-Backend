
import { Schema, Document, model } from "mongoose";
import { PlantCategory } from "./plant.model";

export interface IPlantType extends Document {
  name: string;
  categories: PlantCategory[];
}

const plantTypeSchema = new Schema<IPlantType>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    categories: {
      type: [String],

      enum: Object.values(PlantCategory),
      required: true,

      validate: {
        validator: (value: PlantCategory[]) =>
          Array.isArray(value) &&
          value.length > 0 &&
          value.every((item) =>
            Object.values(PlantCategory).includes(item)
          ) &&
          new Set(value).size === value.length,

        message: "Select valid and unique categories",
      },
    },
  },
  { timestamps: true }
);

const PlantTypeModel = model<IPlantType>(
  "system_plant_types",
  plantTypeSchema
);

export default PlantTypeModel;