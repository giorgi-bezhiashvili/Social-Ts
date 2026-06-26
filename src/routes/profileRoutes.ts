import express , { Router, type Request, type Response } from "express";
const router = Router();
import multer from "multer";
import { authenticateToken } from "../utils/jwt";
import User from "../models/userSchema";
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
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only'));
    cb(null, true);
  }
});
router.post("/:id/profilePicture", authenticateToken, upload.single('profilePic'), async (req, res) => {
    try {
        const userId = req.user?._id
        if (!req.file) {
            console.log("❌ Multer did not receive a valid binary file stream! req.body is:", req.body);
            return res.status(400).json({ 
                error: "No binary file uploaded.", 
                receivedBodyText: req.body 
            });
        }


        const profilePicturePath = `/uploads/${req.file.filename}`;
        const profilePictureUrl = `${req.protocol}://${req.get("host")}${profilePicturePath}`;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).send("User doesn't exist");
        }
        const oldProfilePicturePath = user.profilePicture as string; 
        if(!oldProfilePicturePath) {
            console.log("No existing profile picture to delete for user:", userId);
        }
        user.profilePicture = profilePicturePath
        await user.save();
        const fullPath = path.join(import.meta.dirname, "..", "..", oldProfilePicturePath);

        if (oldProfilePicturePath) {
            fs.unlink(path.join(fullPath), (err) => {
                if (err) {
                    console.error("Error deleting old profile picture:", err);
                } else {
                    console.log("Old profile picture deleted successfully.");
                }
            });
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
router.post("/:id/description", authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = req.params.id;
        const { description } = req.body;

        const user = await User.findByIdAndUpdate(
            userId,
            {description},
            { returnDocument: 'after' }
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