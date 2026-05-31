import mongoose, { Schema, Document } from "mongoose";
interface IPost {
  title: string;
  description: string;
  pictures: string[]; 
}

export interface IUser extends Document {
  userName: string;
  password?: string; 
  email: string;
  posts: IPost[];
}

const userSchema = new Schema<IUser>({
  userName: { type: String, required: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  posts: [{
    title: { type: String, required: true },
    description: { type: String, required: true },
    pictures: [{ type: String }] 
  }],
});

const User = mongoose.model<IUser>("User", userSchema);
export default User;
