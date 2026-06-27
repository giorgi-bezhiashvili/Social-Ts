import User from "../models/userSchema";
import Post from "../models/postSchema";

type PostPayload = {
  title: string;
  description?: string;
  pictures?: string[];
};
type numbers = {
  likes:number,
  commentsCount:number,
  uptimeInHours:number,
}

export async function addPost(userId: string, payload: PostPayload) {
  const { title, description, pictures } = payload;

  const user = await User.findById(userId); // ✅ check user exists first
  if (!user) {
    const err: any = new Error("User not found");
    err.code = "USER_NOT_FOUND";
    throw err;
  }

  const post = new Post({ title, description, pictures, author: userId });
  await post.save();

  return post;
}
export async function getUserPosts(userId: string) {
  const user = await User.findById(userId).populate("posts");
  if (!user) {
    const err: any = new Error("User not found");
    err.code = "USER_NOT_FOUND";
    throw err;
  }
  return user.posts;
}

export async function listPosts() {
  return await Post.find({})
    .populate("author", "userName -_id")
    .select("title description author")
    .lean();
}

export async function likePost(postId: string, userId: string) {
  const user = await User.findOneAndUpdate(
    { _id: userId, likedPosts: { $ne: postId } } as any,
    { $push: { likedPosts: postId } },
    { returnDocument: "after" },
  );

  if (!user) {
    const err: any = new Error("Already liked");
    err.code = "ALREADY_LIKED";
    throw err;
  }

  const post = await Post.findByIdAndUpdate(
    postId,
    { $inc: { likes: 1 } },
    { returnDocument: "after" },
  );

  if (!post) {
    const err: any = new Error("Post not found");
    err.code = "POST_NOT_FOUND";
    throw err;
  }

  return post;
}

export async function unlikePost(postId: string, userId: string) {
  const user = await User.findOneAndUpdate(
    { _id: userId, likedPosts: { $in: [postId] } } as any,
    { $pull: { likedPosts: postId } },
    { returnDocument: "after" },
  );

  if (!user) {
    const err: any = new Error("Not liked yet");
    err.code = "NOT_LIKED";
    throw err;
  }

  const post = await Post.findByIdAndUpdate(
    postId,
    { $inc: { likes: -1 } },
    { returnDocument: "after" },
  );

  if (!post) {
    const err: any = new Error("Post not found");
    err.code = "POST_NOT_FOUND";
    throw err;
  }

  return post;
}
export async function deletePost(postId: string, userId: string) {
  const post = await Post.findOneAndDelete({ _id: postId, author: userId });
  const user = await User.findByIdAndUpdate(userId, { $pull: { posts: postId } });
  const users = await User.updateMany({ likedPosts: postId }, { $pull: { likedPosts: postId } });
  if (!post) {
        const err:any = new Error("Post not found or you don't have permission to delete it")
        err.code = "POST_NOT_FOUND_OR_UNAUTHORIZED";
        throw err;
  }
  return post;
}
export async function countScore(postId: string) {
  try {
    const post = await Post.findById(postId).populate('commentsCount');
    
    if (!post) {
      throw new Error('პოსტი ვერ მოიძებნა');
    }

    const createdTime = new Date(post.createdAt).getTime();
    const currentTime = new Date().getTime();
    const differenceInMilliseconds = currentTime - createdTime;
    
   
    const uptimeInHours = Math.max(differenceInMilliseconds / (1000 * 60 * 60), 1);

    const likesCount = (post.likes as number) || 0;
    const commentsCount = (post.commentsCount as number) || 0;

    const score = (commentsCount * 2 + likesCount) / uptimeInHours;

    return score;
  } catch (error) {
    console.error("შეცდომა:", error);
    throw error;
  }
}

