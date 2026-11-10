import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { UserRole, UserModel } from "../models/user.model";
import { promises } from "node:dns";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: UserRole
  };
}
interface TokenPayload extends JwtPayload {
  id: string;
}


export const authenticate = async(
req: AuthRequest,
 res: Response,
 next: NextFunction)
: Promise<void> => {
  const authReq = req as AuthRequest; 
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      message: "Authentication token is required",
    });
    return;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({
      message: "Invalid authentication token",
    });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      res.status(500).json({
        message: "JWT_SECRET is not configured",
      });
      return;
    }

    const decoded = jwt.verify(token, secret);

    if (
      typeof decoded !== "object" ||
      !decoded ||
      typeof decoded.id !== "string"
    ) {
      res.status(401).json({
        message: "Invalid token payload",
      });
      return;
    }

    const tokenPayload = decoded as TokenPayload;

    const user = await UserModel.findById(tokenPayload.id).select(
      "_id role isActive"
    );

    if (!user) {
      res.status(401).json({
        message: "User account not found",
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        message: "Your account is deactivated",
      });
      return;
    }

    authReq.user = {
      id: user._id.toString(),
      role: user.role,
    }
    next();
  } catch {
    res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

export const adminOnly = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authReq = req as AuthRequest;

  if (!authReq.user) {
    res.status(401).json({
      message: "Please login first",
    });
    return;
  }

  if (authReq.user.role !== "ADMIN" && authReq.user.role !== "SUPER_ADMIN") {
    res.status(403).json({
      message: "Admin access only",
    });
    return;
  }

  next();
};

export const allowRoles = (...roles: UserRole[]) => {

  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {

    const authReq = req as AuthRequest;

    if (!authReq.user) {
      res.status(401).json({
        message: "Please login first",
      });
      return;
    }

    if (!roles.includes(authReq.user.role)) {
      res.status(403).json({
        message: "You do not have permission to perform this action",
      });
      return;
    }

    next();
  };
};
