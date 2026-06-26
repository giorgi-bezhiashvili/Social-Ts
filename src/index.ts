import "dotenv/config";
import path from "path";
import express from "express";
import mongoose from "mongoose";
import http from "http";
import authRouter from "./routes/authRoutes";
import postRouter from "./routes/postRoutes";
import profileRouter from "./routes/profileRoutes";
import commentRouter from "./routes/commentRoutes";
import followingRouter from "./routes/followingRouters";
import NotificationRouter from "./routes/notificationRoutes";
import helmet from "helmet";
import { xss } from "express-xss-sanitizer";
import cookieParser from "cookie-parser";
import { initSocket } from "./utils/socket";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const MONGO_URI = process.env.MONGO_URI as string

if (!MONGO_URI) {
  throw new Error("MONGO_URI is required");
}

app.use(express.json());
app.use(cookieParser());
app.use(helmet());
app.use(helmet.contentSecurityPolicy({ directives: { defaultSrc: ["'self'"] } }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.post("/register-test", (req, res) => res.json({ ok: true }));

app.use(authRouter);
app.use(postRouter);
app.use(NotificationRouter); 
app.use(profileRouter);
app.use(commentRouter);
app.use(followingRouter);

async function connect() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`Database connected successfully`);
  } catch (err) {
    console.error(`Database connection failed:`, err);
    process.exit(1);
  }
}

const server = http.createServer(app);
initSocket(server);

connect().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
