import mongoose, { Schema, Document } from "mongoose";

export interface IComment {
  content: string;
  userId: mongoose.Types.ObjectId;
}

export interface IPost extends Document {
  title: string;
  description: string;
  pictures: string[];
  comments: IComment[];
  likes: number;
  author: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const postSchema = new Schema<IPost>({
  title: { type: String, required: true },
  description: { type: String },
  pictures: [{ type: String }],
  likes: { type: Number, default: 0 },
  author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  comments: [
    {
      content: { type: String, required: true },
      userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    }
  ]
}, { timestamps: true });

const Post = mongoose.model<IPost>("Post", postSchema);
export default Post;
