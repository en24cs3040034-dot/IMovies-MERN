import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { api } from "./api";
import "bootstrap/dist/css/bootstrap.min.css";
import "./style.css";

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("imovies_user") || "null"));
  const [toast, setToast] = useState("");
  const notify = msg => { setToast(msg); setTimeout(() => setToast(""), 3200); };
  function login(data) { localStorage.setItem("imovies_token", data.token); localStorage.setItem("imovies_user", JSON.stringify(data.user)); setUser(data.user); }
  function logout() { localStorage.removeItem("imovies_token"); localStorage.removeItem("imovies_user"); setUser(null); }
  return <BrowserRouter><nav className="navbar navbar-expand-lg navbar-dark topbar"><div className="container"><Link className="navbar-brand logo" to="/">i<span>Movies</span><b>.</b></Link><div className="d-flex align-items-center gap-3"><Link className="nav-link" to="/bookings">My bookings</Link>{user ? <><span className="user-chip">Hi, {user.name.split(" ")[0]}</span><button className="btn btn-sm btn-outline-light" onClick={logout}>Log out</button></> : <Link className="btn btn-sm btn-primary rounded-pill px-3" to="/login">Sign in</Link>}</div></div></nav>
    {toast && <div className="toast-msg">{toast}</div>}
    <main><RoutesWrapper user={user} login={login} notify={notify}/></main>
    <footer><div className="container d-flex justify-content-between flex-wrap gap-2"><span className="logo">iMovies<span className="muted"> — stories worth stepping out for.</span></span><span className="muted">A student project · Demo payments only</span></div></footer>
  </BrowserRouter>;
}
function RoutesWrapper(props) {
  const { pathname } = useLocation();
  if (pathname === "/login" || pathname === "/register") return <AuthPage {...props} mode={pathname.slice(1)} />;
  if (pathname.startsWith("/movie/")) return <MoviePage {...props} />;
  if (pathname === "/bookings") return <Bookings {...props} />;
  return <Home {...props} />;
}
function Home({ notify }) {
  const [movies,setMovies] = useState([]), [search,setSearch] = useState(""), [loading,setLoading] = useState(true);
  useEffect(() => { api.get("/movies").then(r=>setMovies(r.data.movies)).catch(()=>notify("Could not load movies. Is the backend running?")).finally(()=>setLoading(false)); }, []);
  const filtered = movies.filter(m => `${m.title} ${m.genre?.join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  return <><section className="hero"><div className="container hero-inner"><div className="eyebrow"><span className="live-dot"/> THE BIG SCREEN IS CALLING</div><h1>Less scrolling.<br/><em>More stories.</em></h1><p>Find your next favourite film, pick the perfect seat, and make a night of it.</p><div className="search-wrap"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search movies, genres..." aria-label="Search movies"/><kbd>↵</kbd></div><div className="hero-foot"><span>✦ Curated for your next movie night</span><span>INDORE · INDIA</span></div></div><div className="hero-orb orb-one"/><div className="hero-orb orb-two"/></section>
  <section className="container catalog"><div className="section-head"><div><div className="eyebrow">NOW SHOWING</div><h2>Pick your <em>escape.</em></h2></div><span className="muted">{filtered.length} films to explore</span></div>
  {loading ? <div className="empty">Loading the good stuff…</div> : filtered.length ? <div className="movie-grid">{filtered.map((m,i)=><MovieCard key={m._id} movie={m} index={i}/>)}</div> : <div className="empty">No movies match that search. Try another title.</div>}</section>
  <section className="container perks"><div><span className="perk-icon">◈</span><b>Your seat, your choice</b><small>Choose from live seat availability.</small></div><div><span className="perk-icon">✦</span><b>Easy booking</b><small>Your plans, sorted in a few clicks.</small></div><div><span className="perk-icon">↗</span><b>All in one place</b><small>Find your bookings whenever you need.</small></div></section></>;
}
function MovieCard({movie,index}) {
  return <Link to={`/movie/${movie._id}`} className="movie-card" style={{animationDelay:`${index*70}ms`}}><div className="poster-wrap">{movie.poster ? <img src={movie.poster} alt={`${movie.title} poster`} onError={e=>{e.currentTarget.style.display="none"}}/> : <div className="poster-placeholder">IM</div>}<div className="poster-overlay"><span>VIEW SHOWTIMES ↗</span></div><span className="rating">★ {movie.rating || "—"}</span></div><div className="movie-meta"><div className="movie-title">{movie.title}</div><div className="movie-sub">{movie.genre?.slice(0,2).join(" · ")} <span>•</span> {movie.language}</div></div></Link>;
}
function MoviePage({notify,user}) {
  const {id}=useParams(), [movie,setMovie]=useState(null), [shows,setShows]=useState([]), [chosen,setChosen]=useState(null), [seatData,setSeatData]=useState(null), [selected,setSelected]=useState([]);
  const navigate=useNavigate();
  async function loadSeats(showId) { const r=await api.get(`/shows/${showId}/seats`); setSeatData(r.data); setSelected([]); setChosen(showId); }
  useEffect(()=>{api.get(`/movies/${id}`).then(r=>setMovie(r.data)).catch(()=>notify("Movie not found."));api.get(`/shows?movieId=${id}`).then(r=>setShows(r.data)).catch(()=>{});},[id]);
  useEffect(()=>{if(!chosen)return; const socket=io(import.meta.env.VITE_SOCKET_URL||"http://localhost:5000");socket.emit("join-show",chosen);socket.on("seats-updated",()=>loadSeats(chosen));return()=>socket.disconnect();},[chosen]);
  async function book() { if(!user){navigate("/login");return;} try {await api.post("/bookings",{showId:chosen,seats:selected});notify("Booking confirmed! Your seats are yours.");navigate("/bookings");} catch(e){notify(e.response?.data?.message||"Booking failed.");if(chosen)loadSeats(chosen);} }
  if(!movie)return <div className="container empty">Loading movie…</div>;
  return <div className="container detail-page"><Link to="/" className="back-link">← All movies</Link><div className="detail-hero"><img src={movie.poster} alt=""/><div><div className="eyebrow">MOVIE SPOTLIGHT</div><h1>{movie.title}</h1><div className="detail-tags"><span>★ {movie.rating}/10</span><span>{movie.duration} min</span><span>{movie.language}</span></div><p>{movie.description}</p><div className="genre-row">{movie.genre?.map(g=><span key={g}>{g}</span>)}</div></div></div>
  <div className="section-head"><div><div className="eyebrow">MAKE IT A MOVIE NIGHT</div><h2>Choose a <em>showtime.</em></h2></div></div>
  {shows.length ? <div className="show-grid">{shows.map(s=><button className={`show-card ${chosen===s._id?"chosen":""}`} key={s._id} onClick={()=>loadSeats(s._id)}><b>{new Date(s.startsAt).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</b><strong>{new Date(s.startsAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</strong><span>{s.theatre} · ₹{s.price}</span></button>)}</div>:<div className="empty">No upcoming shows yet. Try again later.</div>}
  {seatData && <div className="seat-panel"><div className="section-head"><div><div className="eyebrow">LIVE AVAILABILITY</div><h2>Choose your <em>seats.</em></h2></div><span className="muted">{selected.length} selected · ₹{selected.length*seatData.price}</span></div><div className="screen">SCREEN THIS WAY</div><div className="seat-grid">{seatData.seats.map(s=><button key={s.number} disabled={s.status!=="available"} title={`${s.number} — ${s.status}`} className={`seat ${s.status==="booked"?"booked":selected.includes(s.number)?"selected":""}`} onClick={()=>setSelected(old=>old.includes(s.number)?old.filter(x=>x!==s.number):old.length<10?[...old,s.number]:old)}>{s.number}</button>)}</div><div className="seat-legend"><span><i/> Available</span><span><i className="sel"/> Selected</span><span><i className="taken"/> Booked</span></div><button className="btn btn-primary book-btn" disabled={!selected.length} onClick={book}>Continue · ₹{selected.length*seatData.price} →</button><p className="tiny-note">Demo booking only. No real payment is collected.</p></div>}
  </div>;
}
function AuthPage({mode,login,notify}) {
 const [name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false); const nav=useNavigate();
 async function submit(e){e.preventDefault();setBusy(true);try{const r=await api.post(`/auth/${mode}`,{name,email,password});login(r.data);nav("/");}catch(err){notify(err.response?.data?.message||"Could not authenticate.");}finally{setBusy(false);}}
 return <div className="auth-bg"><form className="auth-card" onSubmit={submit}><div className="logo auth-logo">i<span>Movies</span><b>.</b></div><div className="eyebrow">{mode==="login"?"WELCOME BACK":"YOUR NEXT NIGHT OUT"}</div><h1>{mode==="login"?"Good to see you.":"Join the story."}</h1><p className="muted">{mode==="login"?"Sign in to manage your bookings.":"Create an account and find your next favourite."}</p>{mode==="register"&&<label>Full name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>}<label>Email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input required minLength="8" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label><button className="btn btn-primary w-100 mt-2" disabled={busy}>{busy?"Please wait…":mode==="login"?"Sign in →":"Create account →"}</button><p className="switch-auth">{mode==="login"?"New to iMovies?":"Already have an account?"} <Link to={mode==="login"?"/register":"/login"}>{mode==="login"?"Create an account":"Sign in"}</Link></p></form></div>;
}
function Bookings({notify,user}) {
 const [items,setItems]=useState([]); const nav=useNavigate();
 async function load(){try{const r=await api.get("/bookings/my");setItems(r.data);}catch{setItems([]);}}
 useEffect(()=>{if(!user){nav("/login");return;}load();},[user]);
 async function cancel(id){try{await api.patch(`/bookings/${id}/cancel`);notify("Booking cancelled.");load();}catch(e){notify(e.response?.data?.message||"Could not cancel booking.");}}
 return <div className="container bookings-page"><div className="eyebrow">YOUR CINEMA DIARY</div><h1>Plans & <em>popcorn.</em></h1><p className="muted">All your tickets, in one place.</p>{items.length===0?<div className="empty booking-empty">No bookings yet. <Link to="/">Find a movie to get started →</Link></div>:<div className="booking-list">{items.map(b=><div className="booking-row" key={b._id}><div className="ticket-icon">▣</div><div className="booking-info"><b>{b.movieTitle}</b><span>{b.theatre} · {new Date(b.startsAt).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</span><span>Seats: {b.seats.join(", ")}</span></div><div className="booking-right"><b>₹{b.total}</b><span className={`status ${b.status}`}>{b.status}</span>{b.status==="confirmed"&&new Date(b.startsAt)>new Date()&&<button onClick={()=>cancel(b._id)}>Cancel</button>}</div></div>)}</div>}</div>;
}
createRoot(document.getElementById("root")).render(<App/>);
