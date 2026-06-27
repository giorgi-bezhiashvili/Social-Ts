import jsonwebtoken from "jsonwebtoken";
import User from "../models/userSchema";
import dotenv from "dotenv";
import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { createClient } from "redis";

dotenv.config();

const accessSecret = process.env.ACCESS_TOKEN_SECRET as string;
const refreshSecret = process.env.REFRESH_TOKEN_SECRET as string;
const issuer = process.env.TOKEN_ISSUER || "social-ts";
const audience = process.env.TOKEN_AUDIENCE || "social-ts-client";

const DEFAULT_EXPIRATION = 3600 * 24 * 7; // 7 Days

if (!accessSecret || !refreshSecret) {
  throw new Error(
    "ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be defined in environment variables",
  );
}

// 1. Initialize and Connect to Redis properly
export const redisClient = createClient();
redisClient.on("error", (err) => console.error("Redis Client Error", err));

(async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
})();

export interface AuthenticatedRequest extends Request {
  user?: any;
}

// 2. Token Generation
export async function jwtSign(userId: string) {
  const userInstance = await User.findById(userId);
  if (!userInstance) {
    throw new Error(`User not found`);
  }

  const payLoad = {
    _id: userInstance._id.toString(),
    email: userInstance.email.toString(),
    userName: userInstance.userName.toString(),
  };

  // Short-lived access token
  const AccessToken = jsonwebtoken.sign(payLoad, accessSecret, {
    expiresIn: "15m",
    issuer,
    audience,
    algorithm: "HS256",
  });

  // Create a refresh token with a unique identifier (jti)
  const refreshJti = randomUUID();
  const RefreshToken = jsonwebtoken.sign(
    { sub: userInstance._id.toString() },
    refreshSecret,
    {
      expiresIn: "7d",
      issuer,
      audience,
      algorithm: "HS256",
      jwtid: refreshJti,
    },
  );

  // Sync to Redis and MongoDB
  await redisClient.setEx(`refresh_token:${refreshJti}`, DEFAULT_EXPIRATION, RefreshToken);

  userInstance.refreshTokens = userInstance.refreshTokens || [];
  userInstance.refreshTokens.push(refreshJti);
  await userInstance.save();

  return { AccessToken, RefreshToken };
}

// 3. Middleware for Protected Routes
export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!authHeader || !token) {
    return res.status(401).send("You don't have access");
  }

  try {
    const decoded = jsonwebtoken.verify(token, accessSecret, {
      algorithms: ["HS256"],
      issuer,
      audience,
    }) as any;

    req.user = decoded;
    next();
  } catch (err) {
    return res.sendStatus(403);
  }
}

// 4. Token Verification Logic
export async function verifyRefreshToken(token: string) {
  try {
    const decoded = jsonwebtoken.verify(token, refreshSecret, {
      algorithms: ["HS256"],
      issuer,
      audience,
    }) as any;
    
    const jti = decoded.jti || decoded.jwtid; 
    const sub = decoded.sub as string;
    if (!sub || !jti) throw new Error("Invalid refresh token payload");
    
    // Check Redis Cache first
    const isCached = await redisClient.get(`refresh_token:${jti}`);
    if (!isCached) {
      throw new Error("Refresh token expired or revoked from cache");
    }

    // Fallback sync check with MongoDB
    const user = await User.findById(sub);
    
    if (!user) throw new Error("User not found");
    const activeTokens = user.refreshTokens || [];

    if (!activeTokens.includes(jti)) {
      user.refreshTokens = [];
      await user.save();
      throw new Error("Token reuse detected. Revoking all user sessions.");
    }


    return { user, jti };
  } catch (err) {
    throw err;
  }
}

// 5. Refresh Token Rotation
export async function rotateRefreshToken(oldToken: string) {
  const { user, jti: oldJti } = await verifyRefreshToken(oldToken);

  const newJti = randomUUID();

  // Remove the old tracking identifier across databases
  await redisClient.del(`refresh_token:${oldJti}`);
  user.refreshTokens = (user.refreshTokens || []).filter((t) => t !== oldJti);
  user.refreshTokens.push(newJti);
  await user.save();

  const payLoad = {
    _id: user._id.toString(),
    email: user.email.toString(),
    userName: user.userName.toString(),
  };

  const AccessToken = jsonwebtoken.sign(payLoad, accessSecret, {
    expiresIn: "15m",
    issuer,
    audience,
    algorithm: "HS256",
  });

  const RefreshToken = jsonwebtoken.sign({ sub: user._id.toString() }, refreshSecret, {
    expiresIn: "7d",
    issuer,
    audience,
    algorithm: "HS256",
    jwtid: newJti,
  });

  await redisClient.setEx(`refresh_token:${newJti}`, DEFAULT_EXPIRATION, RefreshToken);
  return { AccessToken, RefreshToken };
}

// 6. Token Revocation (Logout)
export async function revokeRefreshToken(token: string) {
  try {
    const { user, jti } = await verifyRefreshToken(token);
    
    // Clear Redis cache and persist to MongoDB
    await redisClient.del(`refresh_token:${jti}`);
    user.refreshTokens = (user.refreshTokens || []).filter((t) => t !== jti);
    await user.save();
  } catch (err) {
    // Ignore verification failures here to avoid leaking structure details
  }
}