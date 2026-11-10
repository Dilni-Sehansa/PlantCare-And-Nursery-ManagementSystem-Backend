import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import bcrypt from "bcryptjs";
import { UserModel } from "../models/user.model";

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await UserModel.find({
      role: { $in: ["USER", "ADMIN"] },
    })
      .select("-password")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Users retrieved successfully",
      count: users.length,
      users,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getUserStats = async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      totalAdmins,
      activeUsers,
      inactiveUsers,
      activeAdmins,
      inactiveAdmins,
    ] = await Promise.all([
      UserModel.countDocuments({ role: "USER" }),
      UserModel.countDocuments({ role: "ADMIN" }),
      UserModel.countDocuments({ role: "USER", isActive: true }),
      UserModel.countDocuments({ role: "USER", isActive: false }),
      UserModel.countDocuments({ role: "ADMIN", isActive: true }),
      UserModel.countDocuments({ role: "ADMIN", isActive: false }),
    ]);

    res.status(200).json({
      message: "Statistics retrieved successfully",
      stats: {
        totalUsers,
        totalAdmins,
        activeUsers,
        inactiveUsers,
        activeAdmins,
        inactiveAdmins,
        totalAccounts: totalUsers + totalAdmins,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid User ID",
      });
    }

    const user = await UserModel.findById(id).select("-password");

    if (!user || user.role === "SUPER_ADMIN") {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json({
      message: "User retrieved successfully",
      user,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const createAdmin = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    if (!firstName || !lastName || !email || !phone || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPhone = String(phone).trim();

    const existingUser = await UserModel.findOne({
      $or: [
        { email: normalizedEmail },
        { phone: normalizedPhone },
      ],
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Email or phone number already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await UserModel.create({
      firstName,
      lastName,
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashedPassword,
      role: "ADMIN",
      isActive: true,
    });

    res.status(201).json({
      message: "Admin account created successfully",
      admin: {
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        isActive: admin.isActive,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid User ID",
      });
    }

    if (role !== "USER" && role !== "ADMIN") {
      return res.status(400).json({
        message: "Only USER and ADMIN roles are allowed",
      });
    }

    const user = await UserModel.findOne({
      _id: id,
      role: { $ne: "SUPER_ADMIN" },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      message: "User role updated successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid User ID",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "isActive must be true or false",
      });
    }

    const user = await UserModel.findOne({
      _id: id,
      role: { $ne: "SUPER_ADMIN" },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.isActive = isActive;
    await user.save();

    res.status(200).json({
      message: isActive
        ? "Account activated successfully"
        : "Account deactivated successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message,
    });
  }
};