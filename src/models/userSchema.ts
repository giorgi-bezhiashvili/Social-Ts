import mongoose, { Schema, Document, Types } from "mongoose";
import type { IPost } from "./postSchema"
export interface IUser extends Document {
  userName: string;
  password?: string;
  email: string;
  likedPosts: Types.ObjectId[];
  profilePicture?: string;
  description?: string;
  googleId?: string;
  posts?: IPost[];
  refreshTokens?: string[];
}

const userSchema = new Schema<IUser>({
  userName: { type: String, required: true },
  password: { type: String },
  email: { type: String, required: true, unique: true },
  googleId: { type: String, unique: true, sparse: true },
  likedPosts: [{ type: Schema.Types.ObjectId, ref: "Post" }],
  profilePicture: { type: String },
  description: { type: String },
  refreshTokens: [{ type: String }],
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

userSchema.virtual("posts", {
  ref: "Post",
  localField: "_id",
  foreignField: "author"
});

const User = mongoose.model<IUser>("User", userSchema);
export default User;
