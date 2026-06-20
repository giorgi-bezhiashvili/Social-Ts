import "dotenv/config";
import path from "path";
import express from "express";
const app = express();
import mongoose, { mongo } from "mongoose";
import authRouter from "./routes/authRoutes";
import postRouter from "./routes/postRoutes";
import profileRouter from "./routes/profileRoutes"
import commentRouter from "./routes/commentRoutes";
import followingRouter from "./routes/followingRouters"
import helmet from "helmet";
import { xss } from 'express-xss-sanitizer'
import cookieParser from 'cookie-parser';

// 1. Core Express Parsers first
app.use(express.json());
app.use(cookieParser());

// 2. Security Sanitizers next 

app.use(xss({ 
  maxDepth: 50 
} as any));

// 3. HTTP Security Headers
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));
app.use(helmet.contentSecurityPolicy({ directives: { defaultSrc: ["'self'"]} }));

// 4. Static Files & Routes
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(authRouter);
app.use(postRouter);
app.use(profileRouter);
app.use(commentRouter);
app.use(followingRouter)
async function connect() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log(`Database connected successfully`);
  } catch (err) {
    console.log(`Database not connected: ` + err);
  }
}

import http from "http";
import { initSocket } from "./utils/socket";

const server = http.createServer(app);

initSocket(server);

server.listen(3000, () => {
  console.log(`Server Is running on port 3000`);
  connect();
});
