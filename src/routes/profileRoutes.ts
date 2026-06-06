import express , { Router, type Request, type Response } from "express";
const router = Router();
import multer from "multer";
import { authenticateToken } from "../utils/jwt";
import User from "../models/userSchema";
import { getUserPosts } from "../utils/postService";
import path from  "path"
import fs from "fs"; 

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

router.post("/:id/profilePicture", authenticateToken, upload.single('profilePic'), async (req, res) => {
    try {
        const userId = req.params.id;

        if (!req.file) {
            console.log("❌ Multer did not receive a valid binary file stream! req.body is:", req.body);
            return res.status(400).json({ 
                error: "No binary file uploaded.", 
                receivedBodyText: req.body 
            });
        }

        console.log(" File successfully parsed by Multer:", req.file);

        const profilePicturePath = `/uploads/${req.file.filename}`;
        const profilePictureUrl = `${req.protocol}://${req.get("host")}${profilePicturePath}`;

        const user = await User.findByIdAndUpdate(
            userId,
            { profilePicture: profilePicturePath },
            { returnDocument: 'after' }
        );

        if (!user) {
            return res.status(404).send("User doesn't exist");
        }

        return res.status(200).json({
            message: "Uploaded successfully!",
            profilePicture: profilePicturePath,
            profilePictureUrl,
        });

    } catch (err: any) {
        return res.status(500).send("Internal server error: " + err.message);
    }
});

router.get("/:id", async (req, res) => {
    try {
        const userId = req.params.id;

        const user = await User.findById(userId).select(
            "userName email profilePicture description posts",
        );

        if (!user) {
            return res.status(404).send("User doesn't exist");
        }

        res.status(200).json(user);
    } catch (err: any) {
        return res.status(500).send("Internal server error: " + err.message);
    }
});

export default router