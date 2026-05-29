import express, { Router, type Request, type Response } from "express";
import { Interface } from "node:readline";
const router = Router();
import fs from "fs"
import path from "path"
const DATA_FILE = path.join(process.cwd(), "data.json");
import bcrypt from "bcrypt"
function getFileData(){
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE,"utf-8"))
    } catch (err) {
        console.log(err);
    }
}

const saveFileData = (data:User[]) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};
  

interface User {
  userName: string;
  email: string;
  Password?: string; 
}
interface AuthRequestBody {
  userName?: string;
  email?: string;
  Password?: string;
}

router.post(`/register`,async (req: Request, res: Response) => {
    try {
        const {userName,Password,email} = req.body
        if(!userName || !Password || !email){
            return res.status(400).send(`Missing required fields`)
        }
        const users: User[] = getFileData();       
        const userExists = users.some((u) => u.userName === userName || u.email === email)            
        if (userExists) {
            return res.status(400).send("User already exists")
        }
        
        const hashedPassword =await bcrypt.hash(Password,10)
        const newUser:any = {
            userName,
            Password:hashedPassword,
            email,
        }
        users.push(newUser);
        saveFileData(users)
        return res.status(201).send("User registered successfully");
    } catch (err) {
        console.log(err);
        res.status(500).send(`Internal server error`)
    }
});
router.post(`/login`,async(req:Request,res:Response)=>{
    const {userName,Password,email} = req.body
    if(!userName || !Password || !email){
        return res.status(400).send(`Missing required fields`)
    }
    const users: User[] = getFileData(); 
    const user = users.find((u) =>
            userName ? u.userName === userName : u.email === email
    );
    if (!user) {
        return res.status(400).send("Incorrect username or password")
    }
    const isMathc = await bcrypt.compare(Password,user.Password)
    if(!isMathc){
        res.status(400).send(`Incorrect username or password`)
    }
    res.status(200).send(`User logged In succesfully`)
})
export default router;