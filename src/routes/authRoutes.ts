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
import { rateLimit } from 'express-rate-limit'

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 10, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
	ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
	// store: ... , // Redis, Memcached, etc. See below.
})

dotenv.config();

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

passport.serializeUser((user: Express.User, done) => {
  const customUser = user as IUser;
  done(null, customUser._id.toString());
});

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

      // set refresh token in httpOnly cookie
      res.cookie("refreshToken", RefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/auth",
      });

      res.cookie(AccessToken,RefreshToken)
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal server error during token generation");
    }
  },
);

router.get("/", (req: Request, res: Response) => {
  res.send(
    `<a href="https://localhost:3000/auth/google">Authenticate with Google</a>`,
  );
});

router.post("/register", limiter, async (req: Request, res: Response) => {
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
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      userName,
      password: hashedPassword,
      email,
      posts: [],
    };
    const created = await User.create(newUser);
    // sign tokens and set refresh cookie
    const { AccessToken, RefreshToken } = await jwtSign(created._id.toString());
    res.cookie("refreshToken", RefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/auth",
    });
    res.status(201).json({ message: `User created successfully`, AccessToken });
  } catch (err) {
    console.error(err);
    res.status(500).send(`Internal server error`);
  }
});

router.post("/login", limiter, async (req: Request, res: Response) => {
  try {
    const { userName, password, email } = req.body;
    const user = await User.findOne({
      $or: [{ userName: userName }, { email: email }],
    });
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

    res.cookie(AccessToken,RefreshToken)
  } catch (err) {
    console.error(err);
    res.status(500).send(`Internal server error`);
  }
});

// refresh token rotation endpoint
router.post("/auth/refresh", async (req: Request, res: Response) => {
  try {
    const oldToken = req.cookies?.refreshToken;
    if (!oldToken) return res.status(401).send("No refresh token");

    const { AccessToken, RefreshToken } = await rotateRefreshToken(oldToken);

    // set new refresh token cookie
    res.cookie("refreshToken", RefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/auth",
    });

    res.status(200).json({ AccessToken });
  } catch (err) {
    console.error(err);
    res.status(401).send("Invalid refresh token");
  }
});

// logout / revoke
router.post("/auth/logout", async (req: Request, res: Response) => {
  try {
    const oldToken = req.cookies?.refreshToken;
    if (oldToken) {
      await revokeRefreshToken(oldToken);
    }
    res.clearCookie("refreshToken", { path: "/auth" });
    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

export default router;
