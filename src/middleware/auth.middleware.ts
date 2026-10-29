import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: "USER" | "ADMIN"
  };
}
interface TokenPayload extends JwtPayload {
  id: string;
  role: "USER" | "ADMIN";
}

export const authenticate = (
req: AuthRequest,
 res: Response,
 next: NextFunction)
: void => {
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
      typeof decoded.id !== "string" ||
      (decoded.role !== "USER" && decoded.role !== "ADMIN")
    ) {
      res.status(401).json({
        message: "Invalid token payload",
      });
      return;
    }

    authReq.user = decoded as TokenPayload;
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

  if (authReq.user.role !== "ADMIN") {
    res.status(403).json({
      message: "Admin access only",
    });
    return;
  }

  next();
};
