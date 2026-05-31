import express, { Router, type Request, type Response } from "express";
const router = Router();
import bcrypt from "bcrypt"
import User from "../models/userSchema"

router.post(`/register`,async (req,res)=>{
    try {
        const {userName,password,email} = req.body
        if(!userName || !password || !email){
            return res.status(400).send(`Required info isn't specified`)
        }
        const user = await User.findOne({
            $or: [
                { userName: userName },
                { email: email }
            ]
        });
        if(user){
            return res.status(400).send(`User already exists`)
        }
        const hashedPassword =await bcrypt.hash(password,10)
        const newUser={
            userName,
            Password:hashedPassword,
            email,
        }
        await User.create(newUser)
        res.status(201).send(`User created succesfully`)
    } catch (err) {
        console.log(err);
        res.status(500).send(`Internal serrver error`)
    }
})
router.post(`/login`,async(req,res)=>{
    try {
        const {userName,password,email} = req.body
        const user = await User.findOne({
            $or: [
                { userName: userName },
                { email: email }
            ]
        });
        if(!user){
            return res.status(400).send(`Username or password is incorrect`)
        }
        const isMatch = await bcrypt.compare(password,user.password as string)
        if(!isMatch){
            return res.status(400).send(`Username or password is incorrect`)
        }
        res.status(200).send(`User logged in succesfully`)
    } catch (err) {
        console.log(err);
        res.status(500).send(`Internal server error`)
    }
})
export default router;