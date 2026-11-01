import { Schema, model } from "mongoose";

export interface IInternalStockUsage {
    usageId: string;
    internalItemId: string;
    itemName: string;
    quantity: number;
    unit: string;
    usageDate: Date;
    notes?: string;
}

const internalStockUsageSchema = new Schema<IInternalStockUsage>({
        usageId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        internalItemId: {
            type: String,
            required: true,
            trim: true,
        },

        itemName: {
            type: String,
            required: true,
            trim: true,
        },

        quantity: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: Number.isInteger,
                message: "Quantity must be a whole number",
            },
        },

        unit: {
            type: String,
            required: true,
            trim: true,
        },

        usageDate: {
            type: Date,
            default: Date.now,
        },

        notes: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    });

export const InternalStockUsageModel = model<IInternalStockUsage>(
    "System_InternalStockUsage",
    internalStockUsageSchema
);