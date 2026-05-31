import 'dotenv/config'
import router from "./routes/authRoutes";
import express from "express"
const app = express()
import mongoose, { mongo } from "mongoose"
app.use(express.json())
app.use(router)


async function connect() {
    try{
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log(`Database connected successfully`);
    } catch (err) {
        console.log(`Database not connected: ` + err);
    }
}

app.listen(3000, () => {
    console.log(`Server Is running on port 3000`);
    connect()
});
