// src/routes/postRoutes.ts
import express, { Router, type Request, type Response } from "express";
const router = Router();
import User from "../models/userSchema";
import { authenticateToken } from "../utils/jwt";
import Post from "../models/postSchema";
import Notification from "../models/notificationScema";
import { getIo } from "../utils/socket";

router.post("/posts/:postId/comment", authenticateToken, async (req: Request, res: Response) => {
  try {
    const postId = req.params.postId;
    const content = req.body.content;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User identification failed" });
    }

    if (!content) {
      return res.status(400).json({ message: "Comment content is required" });
    }
    const post = await Post.findByIdAndUpdate(
      postId, 
      { $push: { comments: { content, userId } } }, 
      {returnDocument: 'after'}
    );
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    const notification = new Notification({
      recipient: post.author,
      sender: userId,
      message: "commented on your post",
      type: "comment",
      post: postId,
    });
    await notification.save();

    try {
      const io = getIo();
      io.to(String(post.author)).emit("notification", {
        recipient: String(post.author),
        sender: userId,
        type: "comment",
        post: postId,
        message: "commented on your post",
      });
    } catch (e) {
      // ignore if socket not initialized
    }

    return res.status(200).json({ message: "Comment added successfully", post });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err });
  }
})
router.get("/posts/:postId/comments", async (req: Request, res: Response) => {
  try {
    const postId = req.params.postId;

    const post = await Post.findById(postId).populate({
      path: "comments.userId",
      select: "userName profilePicture -_id"
    }).lean();;

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    return res.status(200).json(post.comments);
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err });
  }
});

export default router;
