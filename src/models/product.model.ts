
import { Schema, Document, model } from "mongoose";

export enum ProductCategory {
    FERTILIZER = "Fertilizer",
    PESTICIDE = "Pesticide",
    MEDICINE = "Medicine",
    SEEDS = "Seeds",
    OTHER = "Other",
}

export enum ProductStatus {
    ACTIVE = "Active",
    INACTIVE = "Inactive",
}

export interface IProduct extends Document {
    productId: string;
    productName: string;
    category: ProductCategory;
    description: string;
    unit: string;
    buyingPrice: number;
    sellingPrice: number;
    stock: number;
    status: ProductStatus;
}

const productSchema = new Schema<IProduct>(
    {
        productId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
        },

        productName: {
            type: String,
            required: true,
            trim: true,
        },

        category: {
            type: String,
            enum: Object.values(ProductCategory),
            required: true,
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

        buyingPrice: {
            type: Number,
            required: true,
            min: 0,
        },

        sellingPrice: {
            type: Number,
            required: true,
            min: 0,
        },

        stock: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
            validate: {
                validator: (value: number) =>
                    Number.isInteger(value),
                message: "Stock must be a whole number",
            },
        },

        status: {
            type: String,
            enum: Object.values(ProductStatus),
            required: true,
            default: ProductStatus.ACTIVE,
        },
    },
    {
        timestamps: true,
    }
);


export const ProductModel = model<IProduct>("System_Product",productSchema);
