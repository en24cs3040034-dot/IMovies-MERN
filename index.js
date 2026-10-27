import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import rateLimit from "express-rate-limit";
import { User, Movie, Show, Booking } from "./models.js";
import { auth, adminOnly } from "./middleware.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_URL || "http://localhost:5173" } });
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.get("/api/health", (_req, res) => res.json({ status: "ok", app: "IMovies" }));

const issueToken = user => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
app.post("/api/auth/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password || password.length < 8)
      return res.status(400).json({ message: "Name, email, and a password of at least 8 characters are required." });
    if (await User.findOne({ email })) return res.status(409).json({ message: "Email is already registered." });
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 12) });
    res.status(201).json({ token: issueToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { next(e); }
});
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email?.toLowerCase() });
    if (!user || !(await bcrypt.compare(req.body.password || "", user.password)))
      return res.status(401).json({ message: "Incorrect email or password." });
    res.json({ token: issueToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { next(e); }
});

app.get("/api/movies", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.search) filter.title = { $regex: String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    if (req.query.genre) filter.genre = req.query.genre;
    if (req.query.language) filter.language = req.query.language;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(24, Math.max(1, Number(req.query.limit) || 12));
    const [movies, total] = await Promise.all([Movie.find(filter).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit), Movie.countDocuments(filter)]);
    res.json({ movies, page, pages: Math.ceil(total / limit), total });
  } catch (e) { next(e); }
});
app.get("/api/movies/:id", async (req, res, next) => {
  try { const movie = await Movie.findById(req.params.id); if (!movie) return res.status(404).json({ message: "Movie not found." }); res.json(movie); }
  catch (e) { next(e); }
});
app.get("/api/shows", async (req, res, next) => {
  try {
    const filter = { startsAt: { $gte: new Date() } };
    if (req.query.movieId) filter.movie = req.query.movieId;
    const shows = await Show.find(filter).populate("movie", "title poster").sort({ startsAt: 1 }).limit(100);
    res.json(shows);
  } catch (e) { next(e); }
});
app.get("/api/shows/:id/seats", async (req, res, next) => {
  try { const show = await Show.findById(req.params.id).select("seats price theatre startsAt"); if (!show) return res.status(404).json({ message: "Show not found." }); res.json(show); }
  catch (e) { next(e); }
});
app.post("/api/bookings", auth, async (req, res, next) => {
  try {
    const { showId, seats } = req.body;
    if (!showId || !Array.isArray(seats) || seats.length < 1 || seats.length > 10 || new Set(seats).size !== seats.length)
      return res.status(400).json({ message: "Choose between 1 and 10 unique seats." });
    const show = await Show.findById(showId).populate("movie", "title");
    if (!show || show.startsAt <= new Date()) return res.status(404).json({ message: "Upcoming show not found." });
    const requested = new Set(seats);
    const seatDocs = show.seats.filter(s => requested.has(s.number));
    if (seatDocs.length !== seats.length) return res.status(400).json({ message: "One or more seats are invalid." });
    if (seatDocs.some(s => s.status !== "available")) return res.status(409).json({ message: "A selected seat has just been booked. Please refresh." });
    // Atomic conditional update prevents two users claiming the same seats.
    const updated = await Show.findOneAndUpdate(
      { _id: showId, seats: { $all: seats.map(number => ({ $elemMatch: { number, status: "available" } })) } },
      { $set: Object.fromEntries(seats.map(number => [`seats.$[seat${seats.indexOf(number)}].status`, "booked"])) },
      { arrayFilters: seats.map((number, i) => ({ [`seat${i}.number`]: number, [`seat${i}.status`]: "available" })), new: true }
    );
    if (!updated) return res.status(409).json({ message: "Seat availability changed. Refresh and try again." });
    const booking = await Booking.create({ user: req.user._id, show: show._id, movieTitle: show.movie.title, theatre: show.theatre, startsAt: show.startsAt, seats, total: seats.length * show.price });
    io.to(String(showId)).emit("seats-updated", { showId });
    res.status(201).json(booking);
  } catch (e) { next(e); }
});
app.get("/api/bookings/my", auth, async (req, res, next) => {
  try { res.json(await Booking.find({ user: req.user._id }).sort({ createdAt: -1 })); }
  catch (e) { next(e); }
});
app.patch("/api/bookings/:id/cancel", auth, async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (booking.status === "cancelled") return res.status(400).json({ message: "Booking is already cancelled." });
    const show = await Show.findById(booking.show);
    if (show && show.startsAt > new Date()) {
      await Show.updateOne({ _id: show._id }, { $set: Object.fromEntries(booking.seats.map((s, i) => [`seats.$[seat${i}].status`, "available"])) },
        { arrayFilters: booking.seats.map((number, i) => ({ [`seat${i}.number`]: number, [`seat${i}.status`]: "booked" })) });
      io.to(String(show._id)).emit("seats-updated", { showId: String(show._id) });
    }
    booking.status = "cancelled"; await booking.save(); res.json(booking);
  } catch (e) { next(e); }
});
app.post("/api/admin/movies", auth, adminOnly, async (req, res, next) => {
  try { const movie = await Movie.create(req.body); res.status(201).json(movie); }
  catch (e) { next(e); }
});
app.post("/api/admin/shows", auth, adminOnly, async (req, res, next) => {
  try {
    const { movie, theatre, location, startsAt, price, rows = 5, seatsPerRow = 8 } = req.body;
    if (!movie || !theatre || !startsAt || !price) return res.status(400).json({ message: "movie, theatre, startsAt, and price are required." });
    const seats = [];
    for (let r = 0; r < Math.min(12, Math.max(1, Number(rows))); r++)
      for (let c = 1; c <= Math.min(16, Math.max(1, Number(seatsPerRow))); c++) seats.push({ number: `${String.fromCharCode(65+r)}${c}`, status: "available" });
    const show = await Show.create({ movie, theatre, location, startsAt, price, seats });
    res.status(201).json(show);
  } catch (e) { next(e); }
});
io.on("connection", socket => socket.on("join-show", showId => socket.join(String(showId))));
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
  if (err.name === "CastError") return res.status(400).json({ message: "Invalid ID." });
  if (err.code === 11000) return res.status(409).json({ message: "A record with that value already exists." });
  res.status(500).json({ message: "Server error. Please try again." });
});

const port = process.env.PORT || 5000;
await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/imovies");
server.listen(port, () => console.log(`IMovies API listening on ${port}`));
