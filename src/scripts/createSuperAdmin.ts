import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { UserModel } from "../models/user.model";
import dns from "node:dns";


dotenv.config();

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const createSuperAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGO_URI is missing in .env");
    }

    await mongoose.connect(mongoUri);

    const firstName = process.env.SUPER_ADMIN_FIRST_NAME;
    const lastName = process.env.SUPER_ADMIN_LAST_NAME;
    const email = process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim();
    const phone = process.env.SUPER_ADMIN_PHONE;
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!firstName || !lastName || !email || !phone || !password) {
      throw new Error("Super Admin details are missing in .env");
    }

    if (password.length < 8) {
      throw new Error("Super Admin password must contain at least 8 characters");
    }

    const existingUser = await UserModel.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      if (existingUser.role === "SUPER_ADMIN") {
        console.log("Super Admin account already exists.");
        return;
      }

      throw new Error(
        "This email or phone already belongs to another account."
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const superAdmin = await UserModel.create({
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      role: "SUPER_ADMIN",
      isActive: true,
    });

    console.log("Super Admin created successfully!");
    console.log("Super Admin Email:", superAdmin.email);
    console.log("Super Admin Role:", superAdmin.role);

  } catch (error: any) {
    console.error("Super Admin Creation Failed:", error.message);
  } finally {
    await mongoose.disconnect();
  }
};

createSuperAdmin();