// Required Modules
import express from "express";
import path from "path";             // ← add this
import { dirname } from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./db/connect.js";
import bodyParser from "body-parser";
import "dotenv/config";
// import pageRoutes  from "./routes/pages.js";
import authRoutes  from "./routes/auth.js";
import userRoutes  from "./routes/user.js";
import recipesRouter from "./routes/recipes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ─── static / bodyparsing / uploads ────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(express.static("public"))

connectDB();

// app.use("/", pageRoutes);        
app.use("/", authRoutes);        
app.use("/", userRoutes);    
app.use("/", recipesRouter);    

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
