import { Router, type Request, type Response } from "express"
const router = Router()
import { authenticateToken } from "../utils/jwt";
import User from "../models/userSchema"
const io = require("../utils/socket").getIo();

router.get(`/followersCount/:_id`, authenticateToken, async (req: Request, res: Response) => {
    try {
        const id = req.params._id
        const user = await User.findById(id).populate("followerCount")
        if (!user) {
            res.status(400).send(`Can't find user`)
        }
        res.status(200).send(user)
    } catch (err) {
        res.status(500).send(err)
    }
})
router.post("/follow/:_id", authenticateToken, async (req: Request, res: Response) => {
    try {
        const targetUserId = req.params._id;
        const currentUserId = req.user?._id;
        if (targetUserId === currentUserId) {
            return res.status(400).send(`You can't follow yourself`)
        }
        const targetUser = await User.findOneAndUpdate(
            {
                _id: targetUserId,
                followers: { $ne: currentUserId }
            } as any,
            {
                $addToSet: { followers: currentUserId },
                $inc: { followersCount: 1 }
            },
            { new: true }
        );
        const currentUser = await User.findOneAndUpdate(
            {
                _id: currentUserId,
                following: { $ne: targetUserId }
            } as any,
            {
                $addToSet: { following: targetUserId },
                $inc: { following: 1 }
            }
        )

        if (!targetUser) {
            return res.status(400).send("You already follow this user or user does not exist");
        }
        try {
            io.to(String(targetUserId)).emit("notification", {
                recipient: String(targetUserId),
                sender: currentUserId,
                type: "follow",
                message: "Followed you",
            });
        } catch (e) {
            // ignore if socket not initialized
        }
        return res.status(200).json({ success: true, user: targetUser });

    } catch (err) {
        res.status(500).send(`Error`)
    }
})
router.delete("/unfollow/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
        const targetUserId = req.params._id;
        const currentUserId = req.user?._id;
        const targetUser = await User.findOneAndUpdate(
            {
                _id: targetUserId,
                followers: currentUserId
            } as any,
            {
                $pull: { followers: currentUserId },
                $inc: { followersCount: -1 }
            },
            { new: true }
        );
        const currentUser = await User.findOneAndUpdate(
            {
                _id: currentUserId,
                following: targetUserId
            } as any,
            {
                $pull: { following: targetUserId },
                $inc: { following: -1 }
            }
        )
        if (!targetUser) {
            return res.status(400).send("You already follow this user or user does not exist");
        }
       
        res.status(200).send(`Followed succesfully`)
    } catch (err) {
        res.status(500).send(`Error`)
    }
})

export default router;
