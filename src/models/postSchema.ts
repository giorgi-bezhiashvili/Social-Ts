import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPost {
  title: string;
  description: string;
  pictures: string[];
  likes: number;
  author: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const postSchema = new mongoose.Schema({
  title: String,
  description: String,
  pictures: [String],
  likes: { type: Number, default: 0 },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Reference to User
});

const Post = mongoose.model<IPost>("Post", postSchema);
export default Post;
