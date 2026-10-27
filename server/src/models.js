import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" }
}, { timestamps: true });

const movieSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, index: true },
  description: { type: String, default: "" },
  genre: [{ type: String }],
  language: { type: String, default: "Hindi" },
  duration: { type: Number, default: 120 },
  rating: { type: Number, min: 0, max: 10, default: 8 },
  poster: { type: String, default: "" },
  releaseDate: { type: Date }
}, { timestamps: true });

const showSchema = new mongoose.Schema({
  movie: { type: mongoose.Schema.Types.ObjectId, ref: "Movie", required: true, index: true },
  theatre: { type: String, required: true },
  location: { type: String, default: "Indore" },
  startsAt: { type: Date, required: true, index: true },
  price: { type: Number, required: true, min: 1 },
  seats: [{
    number: String,
    status: { type: String, enum: ["available", "booked"], default: "available" }
  }]
}, { timestamps: true });

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  show: { type: mongoose.Schema.Types.ObjectId, ref: "Show", required: true },
  movieTitle: String,
  theatre: String,
  startsAt: Date,
  seats: [String],
  total: Number,
  status: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed" }
}, { timestamps: true });

export const User = mongoose.model("User", userSchema);
export const Movie = mongoose.model("Movie", movieSchema);
export const Show = mongoose.model("Show", showSchema);
export const Booking = mongoose.model("Booking", bookingSchema);
