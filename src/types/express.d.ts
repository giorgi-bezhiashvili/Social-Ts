// src/types/express.d.ts
import { IUser } from "../models/userSchema";

declare global {
  namespace Express {
    interface User extends IUser {}
  }
}
