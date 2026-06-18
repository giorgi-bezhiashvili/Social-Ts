import jsonwebtoken from "jsonwebtoken";
import User from "../models/userSchema";
import dotenv from "dotenv";
import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

dotenv.config();

const accessSecret = process.env.ACCESS_TOKEN_SECRET as string;
const refreshSecret = process.env.REFRESH_TOKEN_SECRET as string;
const issuer = process.env.TOKEN_ISSUER || "social-ts";
const audience = process.env.TOKEN_AUDIENCE || "social-ts-client";

if (!accessSecret || !refreshSecret) {
  throw new Error(
    "ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be defined in environment variables",
  );
}

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

  // short-lived access token
  const AccessToken = jsonwebtoken.sign(payLoad, accessSecret, {
    expiresIn: "15m",
    issuer,
    audience,
    algorithm: "HS256",
  });

  // create a refresh token with a unique identifier (jti) and store the jti server-side
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

  // persist jti so we can revoke/rotate later
  userInstance.refreshTokens = userInstance.refreshTokens || [];
  userInstance.refreshTokens.push(refreshJti);
  await userInstance.save();

  return { AccessToken, RefreshToken };
}

export interface AuthenticatedRequest extends Request {
  user?: any;
}

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

export async function verifyRefreshToken(token: string) {
  try {
    const decoded = jsonwebtoken.verify(token, refreshSecret, {
      algorithms: ["HS256"],
      issuer,
      audience,
    }) as any;

    const jti = decoded.jti || (decoded as any).jwtid;
    const sub = decoded.sub as string;
    if (!sub || !jti) throw new Error("Invalid refresh token payload");

    const user = await User.findById(sub);
    if (!user) throw new Error("User not found for refresh token");

    if (!user.refreshTokens || !user.refreshTokens.includes(jti)) {
      throw new Error("Refresh token revoked");
    }

    return { user, jti } as { user: typeof user; jti: string };
  } catch (err) {
    throw err;
  }
}

export async function rotateRefreshToken(oldToken: string) {
  const { user, jti: oldJti } = await verifyRefreshToken(oldToken);

  // remove old jti and add new one
  const newJti = randomUUID();

  // filter out old jti
  user.refreshTokens = (user.refreshTokens || []).filter((t) => t !== oldJti);
  user.refreshTokens.push(newJti);
  await user.save();

  // issue new tokens
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

  return { AccessToken, RefreshToken };
}

export async function revokeRefreshToken(token: string) {
  try {
    const { user, jti } = await verifyRefreshToken(token);
    user.refreshTokens = (user.refreshTokens || []).filter((t) => t !== jti);
    await user.save();
  } catch (err) {
    // ignore errors during revoke to avoid leaking info
  }
}
