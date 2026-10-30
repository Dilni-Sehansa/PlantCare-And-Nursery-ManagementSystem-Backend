import { Schema, Document, model } from "mongoose";

export interface IInternalStock extends Document {
    internalItemId: string;
    itemName: string;
    category: string;
    description: string;
    unit: string;
    stock: number;
    buyingPrice: number;
}

const internalStockSchema = new Schema<IInternalStock>(
    {
        internalItemId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
        },

        itemName: {
            type: String,
            required: true,
            trim: true,
        },

        category: {
            type: String,
            required: true,
            trim: true,
        },

        description: {
            type: String,
            required: true,
            trim: true,
        },

        unit: {
            type: String,
            required: true,
            trim: true,
        },

        stock: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
            validate: {
                validator: (value: number) => Number.isInteger(value),
                message: "Stock must be a whole number",
            },
        },

        buyingPrice: {
            type: Number,
            required: true,
            min: 0,
        },
    },
    {
        timestamps: true,
    }
);

export const InternalStockModel = model<IInternalStock>(
    "System_InternalStock",
    internalStockSchema
);