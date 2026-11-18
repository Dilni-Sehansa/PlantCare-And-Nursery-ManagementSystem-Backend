import { Schema, model } from "mongoose";

interface ICounter {
  _id: string;
  sequence: number;
}

const counterSchema = new Schema<ICounter>(
  {
    _id: {
      type: String,
      required: true,
    },
    sequence: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    versionKey: false,
  }
);

export const CounterModel = model<ICounter>(
  "SystemCounter",
  counterSchema,
  "system_counters"
);