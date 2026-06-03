import express, { Router, type Request, type Response } from "express";
const router = Router();
import User from "../models/userSchema";
import { authenticateToken } from "../utils/jwt";
import Post from "../models/postSchema";
router.post(
  "/:_id/posts",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.params._id;
      const { title, description, pictures } = req.body;
      const post = new Post({
        title,
        description,
        pictures,
        author: userId,
      });

      await post.save();

      const user = await User.findByIdAndUpdate(userId, {
        $push: {
          posts: post._id,
        },
      });
      if (!user) {
        await Post.findByIdAndDelete(post._id);
        return res.status(400).send(`User doesn't exists`);
      }
      return res.status(201).json({ message: `Post added successfully`, post });
    } catch (err) {
      res.status(500).send(`Internal server error`);
    }
  },
);

router.get("/:_id/posts", async (req: Request, res: Response) => {
  try {
    const userId = req.params._id;
    const UserPosts = await User.findById(userId).populate("posts");
    if (!UserPosts) {
      return res.send(`User doesn't exists`);
    }
    res.status(200).json(UserPosts.posts);
  } catch (err) {
    return res.status(500).json({ message: "Server error", err });
  }
});
router.get("/posts", async (req: Request, res: Response) => {
  try {
    const posts = await Post.find({})
      .populate("author", "userName -_id")
      .select("title description author")
      .lean();
    res.status(200).send(posts);
  } catch (err) {
    return res.status(500).json({ message: "Server error", err });
  }
});
router.post(
  "/like/:_postId/:_id",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const postId = req.params._postId;
      const userId = req.params._id;

      const user = await User.findOneAndUpdate(
        { _id: userId, likedPosts: { $ne: postId } } as any,
        { $push: { likedPosts: postId } },
        { returnDocument: "after" },
      );

      if (!user) {
        return res
          .status(400)
          .json({ message: "You have already liked this post." });
      }

      const post = await Post.findByIdAndUpdate(
        postId,
        { $inc: { likes: 1 } },
        { returnDocument: "after" },
      );

      if (!post) {
        return res.status(404).json({ message: "Post not found." });
      }

      return res.status(200).json(post);
    } catch (err) {
      return res.status(500).json({ message: "Server error", err });
    }
  },
);

router.post(
  "/downlike/:_postId/:_id",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const postId = req.params._postId;
      const userId = req.params._id;

      const user = await User.findOneAndUpdate(
        { _id: userId, likedPosts: { $in: [postId] } } as any,
        { $pull: { likedPosts: postId } },
        { returnDocument: "after" },
      );
      if (!user) {
        return res
          .status(400)
          .json({ message: "You haven't liked this post yet." });
      }
      const post = await Post.findByIdAndUpdate(
        postId,
        { $inc: { likes: -1 } },
        { returnDocument: "after" },
      );
      if (!post) {
        return res.status(404).json({ message: "Post not found." });
      }

      return res.status(200).json(post);
    } catch (err) {
      return res.status(500).json({ message: "Server error", err });
    }
  },
);

export default router;
