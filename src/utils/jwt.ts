import jsonwebtoken from "jsonwebtoken";
import User from "../models/userSchema";
import dotenv from "dotenv";
import type { NextFunction, Request, Response } from "express";

dotenv.config();

const secret = process.env.ACCESS_TOKEN_SECRET as string

if (!secret) {
    throw new Error("ACCESS_TOKEN_SECRET is not defined in environment variables");
}

export async function jwtSign(userId: string) {
    const userInstance = await User.findById(userId);
    if (!userInstance) {
        throw new Error(`User not found`);
    }

    const payLoad = {
        id: userInstance._id.toString(),
        email: userInstance.email.toString(),
        userName: userInstance.userName.toString()
    };

    const AccessToken = jsonwebtoken.sign(payLoad, secret, { expiresIn: "30m" });
    const RefreshToken = jsonwebtoken.sign(payLoad, secret, { expiresIn: "7d" });

    return { AccessToken, RefreshToken };
}

export interface AuthenticatedRequest extends Request {
    user?: any;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!authHeader || !token) {
        return res.status(401).send("You don't have access");
    }

    jsonwebtoken.verify(token, secret, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }

        req.user = user;
        next();
    });
}
