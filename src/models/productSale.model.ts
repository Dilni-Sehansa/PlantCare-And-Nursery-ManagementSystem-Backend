import { Schema, model } from "mongoose";

export interface IProductSale {
    saleId: string;
    productId: string;
    productName: string;
    quantity: number;
    sellingPrice: number;
    totalAmount: number;
    saleDate: Date;
}

const productSaleSchema = new Schema<IProductSale>(
    {
        saleId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        productId: {
            type: String,
            required: true,
            trim: true,
        },

        productName: {
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

        sellingPrice: {
            type: Number,
            required: true,
            min: 0,
        },

        totalAmount: {
            type: Number,
            required: true,
            min: 0,
        },

        saleDate: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

export const ProductSaleModel = model<IProductSale>(
    "System_ProductSale",
    productSaleSchema
);