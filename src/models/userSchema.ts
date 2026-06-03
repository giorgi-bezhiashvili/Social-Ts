import mongoose, { Schema, Document, Types } from "mongoose";

import { postSchema } from "./postSchema";
import type { IPost } from "./postSchema";
export interface IUser extends Document {
  userName: string;
  password?: string;
  email: string;
  likedPosts: string[];
  posts: Types.DocumentArray<IPost & Types.Subdocument>;
  googleId?: string;
}

const userSchema = new Schema<IUser>({
  userName: { type: String, required: true },
  password: { type: String },
  email: { type: String, required: true, unique: true },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  likedPosts: [{ type: String, default: [] }],
  posts: [postSchema],
});

const User = mongoose.model<IUser>("User", userSchema);
export default User;
