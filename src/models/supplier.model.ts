import { Schema, Document, model } from "mongoose";

export enum Status{
    ACTIVE = "Active",
    INACTIVE = "Inactive"
}
export interface ISupplier extends Document {
    supplierId: string;
    supplierName: string;
    phone: string;
    email: string;
    address: string;
    status: Status
}

const suplierSchema = new Schema<ISupplier>(
    {
        supplierId:{
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
        },

        supplierName: {
            type: String,
            required: true,
            trim: true
        },
        phone: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            match: [/^0[0-9]{9}$/, "Enter a valid 10-digit phone number"],
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/,"Enter a valid email address",],
        },
        address: {
            type: String,
            required: true,
            trim: true
        },
        status: {
            type: String,
            enum: Object.values(Status),
            required: true,
            default: Status.ACTIVE,
        },

    },
    {timestamps: true}
);

export const SupplierModel = model<ISupplier>("System_Supplier",suplierSchema);