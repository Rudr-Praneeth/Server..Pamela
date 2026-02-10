import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import compression from "compression";
import WasteEntry from "./models/WasteEntry.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "50kb" }));
app.use(compression());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });

    console.log("DATABASE CONNECTED");

    app.get("/api/health-check", async (req, res) => {
      res.status(200).json("HEALTHY");
    });

    app.get("/api/waste", async (req, res) => {
      try {
        const year = Number(req.query.year);
        const entries = await WasteEntry.find({ year }).lean();
        const grouped = {};

        entries.forEach(e => {
          if (!grouped[e.month]) grouped[e.month] = [];
          grouped[e.month].push(e);
        });

        res.json(grouped);
      } catch {
        res.status(500).send("Server error");
      }
    });

    app.post("/api/admin-auth", (req, res) => {
      if (req.body.password === process.env.ADMIN_PASSWORD) {
        res.json({ ok: true });
      } else {
        res.status(401).end();
      }
    });

    app.post("/api/waste", async (req, res) => {
      try {
        const data = Array.isArray(req.body) ? req.body : [req.body];
        await WasteEntry.insertMany(data);
        res.status(201).json({ inserted: data.length });
      } catch {
        res.status(500).send("Server error");
      }
    });

    app.listen(process.env.PORT || 5000, () => {
      console.log("SERVER INITIALISED SUCCESSFULLY");
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

startServer();
