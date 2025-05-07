// Required Modules
import express from "express";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./db/connect.js";
import bodyParser from "body-parser";
import "dotenv/config";
import authRoutes from "./routes/auth.js";
import pageRoutes from "./routes/pages.js";
import userRoutes from "./routes/user.js";


const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express();
const PORT = 3000;


app.use(bodyParser.urlencoded({ extended: true}));
app.use(express.static("public"))


// Connect to DB
connectDB();

// Routes
app.use("/", pageRoutes);
app.use("/", authRoutes);
app.use("/", userRoutes);

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
