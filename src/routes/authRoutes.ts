import express, { Router, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import User from "../models/userSchema";
import type { IUser } from "../models/userSchema";
import passport from "passport";
import dotenv from "dotenv";
import { Strategy as GoogleStrategy } from "passport-google-oauth2";
import type { Profile } from "passport";
import type { VerifyCallback } from "passport-google-oauth2";
import { jwtSign, rotateRefreshToken, revokeRefreshToken } from "../utils/jwt";
import { rateLimit } from 'express-rate-limit';
import joi from "joi"
import {registerJoiSchema,loginJoiSchema} from "../utils/validation"
dotenv.config();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  limit: 110, 
  standardHeaders: 'draft-8', 
  legacyHeaders: false, 
  ipv6Subnet: 56, 
});
export const validateBody = (schema: joi.ObjectSchema) => {
  return (req: Request, res: Response, next: any) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      return res.status(400).json({ 
        message: "Validation failed", 
        details: error.details.map(err => err.message) 
      });
    }
    
    req.body = value; 
    next();
  };
};

const router = Router();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      callbackURL: "http://localhost:3000/google/callback",
      passReqToCallback: true,
      scope: ["email", "profile"],
    },
    async function (
      request: Request,
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: VerifyCallback,
    ) {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          const userEmail =
            profile.emails && profile.emails.length > 0
              ? profile.emails[0]?.value || ""
              : "";

          user = await User.create({
            googleId: profile.id,
            email: userEmail,
            userName: profile.displayName || "Google User",
            posts: [],
          });
        }

        return done(null, user);
      } catch (err: any) {
        return done(err);
      }
    },
  ),
);


router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["email", "profile"],
    session: false,
  }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: false,
  }),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as IUser;

      if (!user) {
        return res.status(401).send("Authentication failed");
      }

      const { AccessToken, RefreshToken } = await jwtSign(user._id.toString());

      // Set refresh token in httpOnly cookie
      res.cookie("refreshToken", RefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/auth",
      });

      return res.status(200).json({ AccessToken });
    } catch (err) {
      console.error(err);
      return res.status(500).send("Internal server error during token generation");
    }
  },
);

router.get("/", (req: Request, res: Response) => {
  res.send(
    `<a href="http://localhost:3000/auth/google">Authenticate with Google</a>`,
  );
});

router.post("/register", limiter,validateBody(registerJoiSchema),async (req: Request, res: Response) => {
  try {
    const { userName, password, email } = req.body;
    if (!userName || !password || !email) {
      return res.status(400).send(`Required info isn't specified`);
    }
    const user = await User.findOne({
      $or: [{ userName: userName }, { email: email }],
    });
    if (user) {
      return res.status(400).send(`User already exists`);
    }
    const hashedPassword= await bcrypt.hash(password, 10);
    const newUser = {
      userName,
      password: hashedPassword,
      email,
      posts: [],
    };
    const created = await User.create(newUser);
    
    const { AccessToken, RefreshToken } = await jwtSign(created._id.toString());
    res.cookie("refreshToken", RefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/auth",
    });
    return res.status(201).json({ message: `User created successfully`, AccessToken });
  } catch (err) {
    console.error(err);
    return res.status(500).send(`Internal server error`);
  }
});

router.post("/login", limiter, validateBody(loginJoiSchema),async (req: Request, res: Response) => {
  try {
    const { userName, password, email } = req.body;
    
    const user = await User.findOne({
  $or: [{ userName: userName }, { email: email }],
}).select("+password");
    
    console.log("USER FOUND:", user ? "yes" : "no");
    console.log("USER PASSWORD HASH:", user?.password);
    console.log("PASSWORD TO COMPARE:", password);
    console.log("BCRYPT RESULT:", user ? await bcrypt.compare(password, user.password as string) : "no user");
    
    if (!user) {
      return res.status(400).send(`Username or password is incorrect`);
    }
    const isMatch = await bcrypt.compare(
      password,
      (user.password as string) || "",
    );
    if (!isMatch) {
      return res.status(400).send(`Username or password is incorrect`);
    }
    const { AccessToken, RefreshToken } = await jwtSign(user._id.toString());

    res.cookie("refreshToken", RefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/auth",
    });

    return res.status(200).json({ message: "Login successful", AccessToken });
  } catch (err) {
    console.error(err);
    return res.status(500).send(`Internal server error`);
  }
});

router.post("/auth/refresh", async (req: Request, res: Response) => {
  try {
    const oldToken = req.cookies?.refreshToken;
    if (!oldToken) return res.status(401).send("No refresh token");

    const { AccessToken, RefreshToken } = await rotateRefreshToken(oldToken);

    res.cookie("refreshToken", RefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/auth",
    });

    return res.status(200).json({ AccessToken });
  } catch (err) {
    console.error(err);
    return res.status(401).send("Invalid refresh token");
  }
});

router.post("/auth/logout", async (req: Request, res: Response) => {
  try {
    const oldToken = req.cookies?.refreshToken;
    if (oldToken) {
      await revokeRefreshToken(oldToken);
    }
    res.clearCookie("refreshToken", { path: "/auth" });
    return res.sendStatus(204);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

export default router
