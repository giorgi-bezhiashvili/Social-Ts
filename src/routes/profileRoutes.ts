import express , { Router, type Request, type Response } from "express";
const router = Router();
import multer from "multer";
import { authenticateToken } from "../utils/jwt";
import User from "../models/userSchema";
import path from  "path"
import { promises as fs } from "fs";
import sharp from "sharp";
import { validateBody } from "./authRoutes";
import {commentAndDescriptionJoiSchema} from "../utils/validation"
import * as tf from "@tensorflow/tfjs";
import * as nsfwjs from "nsfwjs";
import type { any } from "joi";

let nsfwModel: Awaited<ReturnType<typeof nsfwjs.load>> | null = null;

async function loadNsfwModel() {
    if (!nsfwModel) {
        nsfwModel = await nsfwjs.load();
        console.log("✅ NSFW Filter Model loaded successfully.");
    }
    return nsfwModel;
}

loadNsfwModel().catch(err => console.error("Failed to load NSFW model:", err));

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = 'uploads/';
    
    try {
      await fs.access(uploadDir).catch(async () => {
        await fs.mkdir(uploadDir, { recursive: true });
      });
      cb(null, uploadDir);
    } catch (err: any) {
      cb(err, uploadDir);
    }
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
async function safeUnlink(filePath: string) {
    try {
        await fs.unlink(filePath);
    } catch (err) {
        console.log(`Note: File at ${filePath} could not be deleted or doesn't exist.`);
    }
}
router.post("/:id/profilePicture", authenticateToken, upload.single('profilePic'), async (req, res) => {
    try {
        const userId = req.user?._id;
        
        if (!req.file) {
            console.log("❌ Multer did not receive a valid binary file stream!", req.body);
            return res.status(400).json({ error: "No binary file uploaded." });
        }

        const user = await User.findById(userId);
        if (!user) {
            await safeUnlink(req.file.path);
            return res.status(404).send("User doesn't exist");
        }

        const tempPath = req.file.path; 
        const profilePicturePath = `/uploads/resized-${req.file.filename}`;
        const targetFullPath = path.join(import.meta.dirname, "..", "..", profilePicturePath);

        try {
            const resizedImageBuffer = await sharp(tempPath)
                .resize(100, 100, { fit: 'cover' })
                .jpeg({ quality: 80 })
                .toBuffer();

            const model = await loadNsfwModel();
            
            const imageTensor = tf.tensor3d(
                new Uint8Array(resizedImageBuffer), 
                [100, 100, 3]
            );
            
            const predictions = await model.classify(imageTensor);
            imageTensor.dispose(); 

            const pornPrediction = predictions.find((p: any) => p.className === 'Porn');
            const hentaiPrediction = predictions.find((p: any) => p.className === 'Hentai');

            const isNsfw = 
                (pornPrediction && pornPrediction.probability > 0.6) || 
                (hentaiPrediction && hentaiPrediction.probability > 0.6);

            if (isNsfw) {
                console.log(`🚫 Upload blocked! NSFW Content detected:`, predictions);
                await safeUnlink(tempPath);
                return res.status(400).json({ 
                    error: "Inappropriate content detected. Profile picture upload rejected." 
                });
            }

            await fs.writeFile(targetFullPath, resizedImageBuffer);
            await safeUnlink(tempPath);

        } catch (err) {
            console.error("Image processing or NSFW check failed:", err);
            await safeUnlink(tempPath);
            return res.status(500).json({ error: "Failed to process image." });
        }

        const oldProfilePicturePath = user.profilePicture as string;
        if (oldProfilePicturePath) {
            const oldFullPath = path.join(import.meta.dirname, "..", "..", oldProfilePicturePath);
            await safeUnlink(oldFullPath);
        }

        user.profilePicture = profilePicturePath;
        await user.save();

        const profilePictureUrl = `${req.protocol}://${req.get("host")}${profilePicturePath}`;

        return res.status(200).json({
            message: "Uploaded successfully!",
            profilePicture: profilePicturePath,
            profilePictureUrl,
        });

    } catch (err: any) {
        if (req.file) {
            await safeUnlink(req.file.path);
        }
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
router.post("/:id/description", authenticateToken,validateBody(commentAndDescriptionJoiSchema), async (req: Request, res: Response) => {
    try {
        const userId = req.user?._id;
        const { content } = req.body;

        const user = await User.findByIdAndUpdate(
            userId,
            {description : content},
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