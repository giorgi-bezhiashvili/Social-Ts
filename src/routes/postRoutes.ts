import express, { Router, type Request, type Response } from "express";
const router = Router();
import User from "../models/userSchema";
import { authenticateToken } from "../utils/jwt";
import Post from "../models/postSchema";
import Notification from "../models/notificationScema";
import {
  addPost,
  getUserPosts,
  listPosts,
  likePost,
  unlikePost,
  deletePost,
  countScore
} from "../utils/postService";
import { getIo } from "../utils/socket";

//posting a post
router.post(
  "/:_id/posts",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (typeof req.params._id !== "string") {
        return res.status(400).send(`Invalid user id`);
      }
      const userId = req.params._id;
      const { title, description, pictures } = req.body;
      const post = await addPost(userId, { title, description, pictures });
      return res.status(201).json({ message: `Post added successfully`, post });
    } catch (err) {
      if ((err as any)?.code === "USER_NOT_FOUND") {
        return res.status(400).send(`User doesn't exists`);
      }
      res.status(500).send(`Internal server error`);
    }
  },
);
//getting posts of a user
router.get("/:_id/posts", async (req: Request, res: Response) => {
  try {
    if (typeof req.params._id !== "string") {
      return res.status(400).send(`Invalid user id`);
    }
    const userId = req.params._id;
    const posts = await getUserPosts(userId);
    res.status(200).json(posts);
  } catch (err) {
    if ((err as any)?.code === "USER_NOT_FOUND") {
      return res.status(400).send(`User doesn't exists`);
    }
    return res.status(500).json({ message: "Server error", err });
  }
});
//getting posts on feed
router.get("/posts", async (req: Request, res: Response) => {
  try {
    const posts = await Post.find()
      .sort({ score: -1 }) 
      .limit(120);
    return res.status(200).json(posts);
  } catch (err) {
    return res.status(500).json({ message: "Server error", err });
  }
});
//like a post
router.post(
  "/like/:_postId/:_id",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (
        typeof req.params._postId !== "string" ||
        typeof req.user?._id !== "string"
      ) {
        return res.status(400).send(`Invalid id(s)`);
      }
      const postId = req.params._postId;
      const userId =req.user?._id

      const post = await likePost(postId, userId);
      const notification = new Notification({
        recipient: post.author,
        sender: userId,
        message: "liked your post",
        type: "like",
        post: postId,
      });
      await notification.save();
      countScore(postId)
      try {

        const io = getIo();
        io.to(String(post.author)).emit("notification", {
          recipient: String(post.author),
          sender: userId,
          type: "like",
          post: postId,
          message: "liked your post",
        });
      } catch (e) {
        // socket may not be initialized; ignore
      }
      return res.status(200).json(post);
    } catch (err) {
      if ((err as any)?.code === "ALREADY_LIKED") {
        return res
          .status(400)
          .json({ message: "You have already liked this post." });
      }
      if ((err as any)?.code === "POST_NOT_FOUND") {
        return res.status(404).json({ message: "Post not found." });
      }
      return res.status(500).json({ message: "Server error", err });
    }
  },
);
//unlike a post
router.post(
  "/downlike/:_postId/:_id",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (
        typeof req.params._postId !== "string" || typeof req.user?._id !== "string") {
        return res.status(400).send(`Invalid id(s)`);
      }
      const postId = req.params._postId;
      const userId = req.user?._id

      const post = await unlikePost(postId, userId);
      countScore(postId)

      return res.status(200).json(post);
    } catch (err) {
      if ((err as any)?.code === "NOT_LIKED") {
        return res
          .status(400)
          .json({ message: "You haven't liked this post yet." });
      }
      if ((err as any)?.code === "POST_NOT_FOUND") {
        return res.status(404).json({ message: "Post not found." });
      }
      return res.status(500).json({ message: "Server error", err });
    }
  },
);
//delete a post
router.delete("/:_id/posts/:postId", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (typeof req.user?._id !== "string" || typeof req.params.postId !== "string") {
      return res.status(400).send(`Invalid id(s)`);
    }
    const userId = req.user?._id
    const postId = req.params.postId;

    await deletePost(postId, userId)
      .then(() => res.status(200).json({ message: "Post deleted successfully" }))
      .catch((err) => {
        if ((err as any)?.code === "POST_NOT_FOUND_OR_UNAUTHORIZED") {
          return res.status(404).json({ message: "Post not found or unauthorized." });
        }
        return res.status(500).json({ message: "Server error", err });
      });
  } catch (err) {
    return res.status(500).json({ message: "Server error", err });
  }
});

export default router;
