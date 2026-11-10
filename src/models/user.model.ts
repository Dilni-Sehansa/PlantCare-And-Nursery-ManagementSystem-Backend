import mongoose, { Schema, Document, model } from "mongoose";

export type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN";

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/,"Enter a valid email address",],
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^0[0-9]{9}$/, "Enter a valid 10-digit phone number"],
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["USER", "ADMIN","SUPER_ADMIN"],
      default: "USER",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const UserModel = model<IUser>("User", userSchema);

export default UserModel;