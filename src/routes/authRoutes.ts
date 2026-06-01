import express, { Router, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import User from "../models/userSchema";
import type { IUser } from "../models/userSchema"; 
import passport from "passport";
import dotenv from "dotenv";
import { Strategy as GoogleStrategy } from "passport-google-oauth2";
import type { Profile } from "passport";
import type { VerifyCallback } from "passport-google-oauth2";
import { jwtSign } from "../utils/jwt";

dotenv.config();

const router = Router();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      callbackURL: "http://localhost:3000/google/callback",
      passReqToCallback: true,
      
      scope: ["email", "profile"] 
    },
    async function (
      request: Request,
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: VerifyCallback
    ) {
      try {
        let user = await User.findOne({ googleId: profile.id });
        
        if (!user) {
          const userEmail = profile.emails && profile.emails.length > 0
            ? profile.emails[0]?.value || ""
            : "";

          user = await User.create({
            googleId: profile.id,
            email: userEmail,
            userName: profile.displayName || "Google User",
            posts: []
          });
        }
        
        return done(null, user);
      } catch (err: any) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user: Express.User, done) => {
  const customUser = user as IUser;
  done(null, customUser._id.toString());
});


router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["email", "profile"], session: false })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login", session: false }),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as IUser;

      if (!user) {
        return res.status(401).send("Authentication failed");
      }

      const { AccessToken, RefreshToken } = await jwtSign(user._id.toString());

      res.status(200).json({
        message: "User logged in via Google successfully",
        AccessToken,
        RefreshToken
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal server error during token generation");
    }
  }
);

router.get("/", (req: Request, res: Response) => {
  res.send(`<a href="https://localhost:3000/auth/google">Authenticate with Google</a>`);
});


router.post("/register", async (req: Request, res: Response) => {
  try {
    const { userName, password, email } = req.body;
    if (!userName || !password || !email) {
      return res.status(400).send(`Required info isn't specified`);
    }
    const user = await User.findOne({
      $or: [
        { userName: userName },
        { email: email }
      ]
    });
    if (user) {
      return res.status(400).send(`User already exists`);
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      userName,
      password: hashedPassword,
      email,
      posts: []
    };
    await User.create(newUser);
    res.status(201).send(`User created successfully`);
  } catch (err) {
    console.error(err);
    res.status(500).send(`Internal server error`);
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { userName, password, email } = req.body;
    const user = await User.findOne({
      $or: [
        { userName: userName },
        { email: email }
      ]
    });
    if (!user) {
      return res.status(400).send(`Username or password is incorrect`);
    }
    const isMatch = await bcrypt.compare(password, (user.password as string) || "");
    if (!isMatch) {
      return res.status(400).send(`Username or password is incorrect`);
    }
    const { AccessToken, RefreshToken } = await jwtSign(user._id.toString());
    res.status(200).json({
      message: "User logged in successfully",
      AccessToken,
      RefreshToken
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(`Internal server error`);
  }
});

export default router;