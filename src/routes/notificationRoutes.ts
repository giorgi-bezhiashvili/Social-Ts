import Notification from "../models/notificationScema";
import mongoose, { Types } from "mongoose";
import { Router, type Request, type Response } from "express";
import { authenticateToken } from "../utils/jwt";
const router = Router();

router.get("/notifications", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User identification failed" });
    }
    const notifications = await Notification.find({ recipient: userId })
    .populate("sender", "userName profilePicture")
    .populate("post", "title")
    .populate("comment", "content")
    .sort({ createdAt: -1 });
    res.status(200).json(notifications);
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err });
  }})