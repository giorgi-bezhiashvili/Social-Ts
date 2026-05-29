import router from "./routes/authRoutes";
import express from "express"
const app = express()
app.use(express.json())
app.use(router)

app.listen(3000, () => {
    console.log(`Server Is running on port 3000`);
});
