import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import WasteEntry from "./models/WasteEntry.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

const startServer = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("DATABASE CONNECTED");

  app.get("/api/waste", async (req, res) => {
    const year = Number(req.query.year);
    const entries = await WasteEntry.find({ year });
    const grouped = {};

    entries.forEach(e => {
      if (!grouped[e.month]) grouped[e.month] = [];
      grouped[e.month].push(e);
    });

    res.json(grouped);
  });

  app.post("/api/admin-auth", (req, res) => {
    if (req.body.password === process.env.ADMIN_PASSWORD) {
      res.json({ ok: true });
    } else {
      res.status(401).end();
    }
  });

  app.post("/api/waste", async (req, res) => {
    const data = Array.isArray(req.body) ? req.body : [req.body];
    await WasteEntry.insertMany(data);
    res.status(201).json({ inserted: data.length });
  });

  app.listen(process.env.PORT || 5000, () => {
    console.log(`SERVER INITIALISED SUCCESSFULLY`);
  });
};

startServer();
