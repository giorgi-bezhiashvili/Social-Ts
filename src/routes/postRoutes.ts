import express, { Router, type Request, type Response } from "express";
const router = Router();
import User from "../models/userSchema"
import { authenticateToken } from "../utils/jwt";

router.post("/:_id/posts",authenticateToken,async(req:Request,res:Response)=>{
    try {
        const userId = req.params._id
        const {title,description,pictures}=req.body
        const newPost = {
            title,
            description,
            pictures,
        }
        const user =await User.findByIdAndUpdate(userId,{
            $push:{
                posts:newPost
            }
        })
        if(!user){
            return res.status(400).send(`User doesn't exists`)
        }
        return res.status(201).send(`Post added succesfully`)
    } catch (err) {
        res.status(500).send(`Internal server error`)
    }
})

router.get("/:_id/posts",async (req:Request,res:Response)=>{
    try {
     const userId = req.params._id
     const UserPosts = await User.findById(userId).populate("posts")
     if(!UserPosts){
        return res.send(`User doesn't exists`)
     }
     res.status(200).json(UserPosts.posts)   
    } catch (err) {
        return res.status(500).json({ message: "Server error", err });
    }
})
export default router;
