import mongoose, { Schema, Document, Types } from "mongoose";
export interface INotification extends Document {
  recipient: Types.ObjectId;
  sender: Types.ObjectId;
  type: string;
  post?: Types.ObjectId;
  comment?: Types.ObjectId;
  createdAt: Date;
}
const notificationSchema = new Schema<INotification>({
  recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
  sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, required: true },
  post: { type: Schema.Types.ObjectId, ref: "Post" },
  comment: { type: Schema.Types.ObjectId },
  createdAt: { type: Date, default: Date.now }
});
const Notification = mongoose.model<INotification>("Notification", notificationSchema);
export default Notification;