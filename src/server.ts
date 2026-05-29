import express, { type Request, type Response } from "express";
const app = express();

app.get(`/`, (req: Request, res: Response) => {
    res.status(200).send(`Hello World`);
});

export default app;