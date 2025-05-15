// ------------------- Required Modules -------------------
import express from "express";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { connectDB, db } from "./db/connect.js";
import bodyParser from "body-parser";
import "dotenv/config";
import session from "express-session";
import pgSession from "connect-pg-simple";
import authRoutes from "./routes/auth.js";
import pageRoutes from "./routes/pages.js";
import { validateSession } from "./middleware/sessionIntegrity.js";
import fs from "fs"; 
import helmet from "helmet";
// ---------------------------------------------------------


const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express();
const PORT = 3000;
const PgSession = pgSession(session);


app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true}));
app.use(express.static("public"))
app.use(helmet.frameguard({ action: "deny" })); // Prevent clickjacking


// ------------------------------------------------------------
const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
// ------------------------------------------------------------

// Connect to DB
connectDB();

// Session configuration
app.use(
  session({
    store: new PgSession({   // Persist sessions securely on backend
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

app.use(validateSession);

app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});


// Routes
app.use("/", pageRoutes);
app.use("/", authRoutes);


app.get("/", (req, res) => {
  console.log(req.session);
  console.log(req.sessionID);
  res.cookie("hello", "world", {maxAge: 30000, signed: true});
  res.status(201).send({msg: "Hello"});
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});