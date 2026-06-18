import "dotenv/config";
import path from "path";
import router from "./routes/authRoutes";
import express from "express";
const app = express();
import mongoose, { mongo } from "mongoose";
import authRouter from "./routes/authRoutes";
import postRouter from "./routes/postRoutes";
import profileRouter from "./routes/profileRoutes"
import commentRouter from "./routes/commentRoutes";
import helmet from "helmet";
import mongosanitize from "express-mongo-sanitize";
import { xss } from 'express-xss-sanitizer'
import cookieParser from 'cookie-parser';
app.use(mongosanitize());

app.use(xss({ 
  maxDepth: 50 
} as any));

app.use(express.json());
app.use(cookieParser());
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }))
app.use(helmet.contentSecurityPolicy({ directives: { defaultSrc: ["'self'"]} }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(router);
app.use(authRouter);
app.use(postRouter);
app.use(profileRouter)
app.use(commentRouter);
async function connect() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log(`Database connected successfully`);
  } catch (err) {
    console.log(`Database not connected: ` + err);
  }
}

app.listen(3000, () => {
  console.log(`Server Is running on port 3000`);
  connect();
});
