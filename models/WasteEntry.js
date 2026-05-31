import mongoose from "mongoose";

const WasteEntrySchema = new mongoose.Schema({
  year: Number,
  month: String,
  date: {
    type: String,
    unique: true,
    sparse: true,
    required: true
  },
  red: Number,
  yellow: Number,
  blue: Number,
  white: Number
});

export default mongoose.model("WasteEntry", WasteEntrySchema);
