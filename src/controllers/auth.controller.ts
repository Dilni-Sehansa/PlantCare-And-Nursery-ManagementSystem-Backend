import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import {UserModel} from "../models/user.model";
import { signAccessToken, signRefreshToken } from "../utils/token";
import { AuthRequest } from "../middleware/auth.middleware";
import jwt from "jsonwebtoken"


export const register = async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const { firstName, lastName, email, phone, password } = body;

    if (
      typeof firstName !== "string" ||
      typeof lastName !== "string" ||
      typeof email !== "string" ||
      typeof phone !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Invalid input data",
      });
    }

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Enter a valid email address",
      });
    }

    const phoneRegex = /^0[0-9]{9}$/;

    if (!phoneRegex.test(normalizedPhone)) {
      return res.status(400).json({
        message: "Enter a valid 10-digit phone number",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters",
      });
    }

    const existingUser = await UserModel.findOne({
      $or: [
        { email: normalizedEmail },
        { phone: normalizedPhone },
      ],
    });
    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
      return res.status(409).json({ message: "User already exists" });
    }

    if (existingUser.phone === normalizedPhone) {
        return res.status(409).json({
          message: "Phone number already exists",
        });
      }
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await UserModel.create({
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashedPassword,
      role: "USER",
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error: any) {

    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || error.keyValue || {})[0];

      if(duplicateField === "email"){
        return res.status(409).json({
          message: "Email already exists",
        });
      }

      if(duplicateField === "phone"){
        return res.status(409).json({
          message: "Phone number already exists",
        });
      }

      return res.status(409).json({
        message: "Duplicate data already exists",
      });
    }

    if(error.name === "ValidationError" || error.name === "CastError"){
      return res.status(400).json({
        message: error.message,
      });
    }

    console.error("Registration Error:", error);

    return res.status(500).json({
      message: "Internal server error during registration",
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const user = await UserModel.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "Your account is deactivated. Please contact the administrator.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    res.status(200).json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyDetails = async (req: AuthRequest, res: Response) => {
  try {

    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.user.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await UserModel.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "Your account is deactivated",
      });
    }

    res.status(200).json({
      message: "Success",
      user,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getRefreshToken = async(req:Request, res:Response) => {
  const {refreshToken} = req.body
  try{
    if(!refreshToken){
      return res.status(400).json({message:"Refresh token is required"})
    }
    const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

    if (!JWT_REFRESH_SECRET) {
      return res.status(500).json({
        message: "JWT_REFRESH_SECRET is not configured",
      });
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    if (
      typeof decoded !== "object" ||
      !decoded ||
      typeof decoded.id !== "string"
    ) {
      return res.status(403).json({
        message: "Invalid or Expired Refresh Token !...",
      });
    }
    const userId = decoded.id;
    const user = await UserModel.findById(userId)

    if(!user){
      return res.status(403).json({
        message:"User not found !..."
      })
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "Your account is deactivated",
      });
    }

    const newAccessToken = signAccessToken(user)
    res.status(200).json({
      message:"Access Token Refreshed Successfully !...",
      accessToken:newAccessToken,
    })
  }
  catch(error){
    res.status(403).json({
      message:"Invalid or Expired Refresh Token !..."
    })
  }
}