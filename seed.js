import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User, Movie, Show } from "./models.js";

await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/imovies");
await Promise.all([User.deleteMany({}), Movie.deleteMany({}), Show.deleteMany({})]);
await User.create([
  { name: "IMovies Admin", email: "admin@imovies.local", password: await bcrypt.hash("Admin123!", 12), role: "admin" },
  { name: "Demo User", email: "user@imovies.local", password: await bcrypt.hash("User123!", 12), role: "user" }
]);
const movies = await Movie.create([
  { title: "The Last Horizon", description: "A pilot follows a mysterious signal beyond the edge of known space.", genre: ["Sci-Fi", "Adventure"], language: "English", duration: 128, rating: 8.4, poster: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=700" },
  { title: "Monsoon Letters", description: "Two strangers discover a set of letters that changes both their lives.", genre: ["Drama", "Romance"], language: "Hindi", duration: 116, rating: 7.9, poster: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=700" },
  { title: "Midnight Run", description: "One night, one city, and a race against time.", genre: ["Thriller", "Action"], language: "Hindi", duration: 134, rating: 8.1, poster: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=700" },
  { title: "Paper Planets", description: "A warm animated adventure about friendship and finding home.", genre: ["Animation", "Family"], language: "English", duration: 102, rating: 8.7, poster: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=700" }
]);
const start = new Date(); start.setDate(start.getDate()+1); start.setHours(14, 0, 0, 0);
for (const [i, movie] of movies.entries()) {
  const time = new Date(start); time.setHours(12 + i*2, 0, 0, 0);
  const seats = [];
  for (let r=0;r<5;r++) for(let c=1;c<=8;c++) seats.push({ number: `${String.fromCharCode(65+r)}${c}`, status: "available" });
  await Show.create({ movie: movie._id, theatre: ["INOX Central","Cinepolis Downtown","PVR Skyline","MovieMax"][i], location: "Indore", startsAt: time, price: 180 + i*30, seats });
}
console.log("Seed complete. Demo users: admin@imovies.local / Admin123! and user@imovies.local / User123!");
await mongoose.disconnect();
