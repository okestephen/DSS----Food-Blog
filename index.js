// Required Modules

import express, { response } from "express";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { connectDB, db } from "./db/connect.js";
import bodyParser from "body-parser";
import "dotenv/config";

// Session Modules
import cookieParser from "cookie-parser";
import session from "express-session";
import pgSession from "connect-pg-simple";
const PgSession = pgSession(session);
// ---------------
import otpRoutes from "./routes/otp.js";
import authRoutes from "./routes/auth.js";
import pageRoutes from "./routes/pages.js";
import { idleTimout } from "./middleware/idleTimeout.js";
// import userRoutes from "./routes/user.js";


const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express();
const PORT = 3000;


app.use(bodyParser.urlencoded({ extended: true}));
app.use(express.static("public"))


// Connect to DB
connectDB();

// Session configuration
app.use(
  session({
    store: new PgSession({   // Persist sessions seucrely on backend
      pool: db,
      tableName: "session",
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
    cookie: {
      httpOnly: true,  // Blocks JS access to session ID
      secure: process.env.NODE_ENV === "production",  // Prevent session leaks over HTTP
      sameSite: "strict",  // Stop CSRF cookie reuse
      maxAge: 1000 * 60 * 60,
    }
  })
)

app.use(idleTimout);

app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});


// Routes
app.use("/", otpRoutes);
app.use("/", pageRoutes);
app.use("/", authRoutes);
// app.use("/", userRoutes);

app.get("/", (req, res) => {
  console.log(req.session);
  console.log(req.sessionID);
  res.cookie("hello", "world", {maxAge: 30000, signed: true});
  res.status(201).send({msg: "Hello"});
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
