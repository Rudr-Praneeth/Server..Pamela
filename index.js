import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import compression from "compression";
import multer from "multer";
import XLSX from "xlsx";
import WasteEntry from "./models/WasteEntry.js";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: "50kb" }));
app.use(compression());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

const normalizeDate = (val) => {
  if (!val) return "";
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return String(val);
};

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

    app.get("/api/waste/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const entry = await WasteEntry.findById(id).lean();

        if (!entry) {
          return res.status(404).json({ error: "Record not found", id });
        }

        res.json(entry);
      } catch (err) {
        res.status(500).json({ error: "Server error", message: err.message });
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
      } catch (err) {
        if (err.code === 11000) {
          const field = Object.keys(err.keyPattern)[0];
          const value = err.keyValue[field];
          res.status(409).json({
            error: `Duplicate entry for ${field}`,
            message: `A record with ${field} "${value}" already exists. Use PUT to update the existing record.`,
            field,
            value
          });
        } else {
          res.status(500).json({ error: "Server error", message: err.message });
        }
      }
    });

    app.post("/api/waste-upload", upload.single("file"), async (req, res) => {
      try {
        if (!req.file) return res.status(400).send("No file");

        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const payload = json.map(row => {
          const keys = Object.keys(row);
          const map = {};
          keys.forEach(k => (map[k.toLowerCase()] = k));

          const get = (names) => {
            const k = names.map(n => map[n]).find(Boolean);
            return k ? row[k] : "";
          };

          const date = normalizeDate(get(["date", "date of entry", "day"]));
          const d = new Date(date);

          return {
            year: !isNaN(d.getTime()) ? d.getFullYear() : new Date().getFullYear(),
            month: !isNaN(d.getTime()) ? d.toLocaleString("default", { month: "long" }) : "",
            date,
            red: Number(get(["red", "red waste", "r"])) || 0,
            yellow: Number(get(["yellow", "yellow waste", "y"])) || 0,
            blue: Number(get(["blue", "blue waste", "b"])) || 0,
            white: Number(get(["white", "white waste", "w"])) || 0
          };
        }).filter(e => e.date);

        if (!payload.length) return res.status(400).send("No valid rows");

        try {
          await WasteEntry.insertMany(payload);
          res.json({ inserted: payload.length });
        } catch (err) {
          if (err.code === 11000) {
            res.status(409).json({
              error: "Duplicate dates found in upload",
              message: "Some records have dates that already exist. Use PUT to update existing records.",
              details: err.message
            });
          } else {
            res.status(500).json({ error: "Server error", message: err.message });
          }
        }
      } catch (err) {
        res.status(500).json({ error: "Server error", message: err.message });
      }
    });

    app.put("/api/waste/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;

        const entry = await WasteEntry.findByIdAndUpdate(
          id,
          updates,
          { new: true, runValidators: true }
        );

        if (!entry) {
          return res.status(404).json({ error: "Record not found", id });
        }

        res.json({ updated: entry });
      } catch (err) {
        if (err.code === 11000) {
          const field = Object.keys(err.keyPattern)[0];
          const value = err.keyValue[field];
          res.status(409).json({
            error: `Duplicate ${field}`,
            message: `A record with ${field} "${value}" already exists.`,
            field,
            value
          });
        } else {
          res.status(500).json({ error: "Server error", message: err.message });
        }
      }
    });

    app.patch("/api/waste/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;

        const entry = await WasteEntry.findByIdAndUpdate(
          id,
          updates,
          { new: true, runValidators: true }
        );

        if (!entry) {
          return res.status(404).json({ error: "Record not found", id });
        }

        res.json({ updated: entry });
      } catch (err) {
        if (err.code === 11000) {
          const field = Object.keys(err.keyPattern)[0];
          const value = err.keyValue[field];
          res.status(409).json({
            error: `Duplicate ${field}`,
            message: `A record with ${field} "${value}" already exists.`,
            field,
            value
          });
        } else {
          res.status(500).json({ error: "Server error", message: err.message });
        }
      }
    });

    app.delete("/api/waste/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const entry = await WasteEntry.findByIdAndDelete(id);

        if (!entry) {
          return res.status(404).json({ error: "Record not found", id });
        }

        res.json({ deleted: entry });
      } catch (err) {
        res.status(500).json({ error: "Server error", message: err.message });
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