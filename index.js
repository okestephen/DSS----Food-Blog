// Required Modules
import express from "express";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./db/connect.js";
import bodyParser from "body-parser";
import "dotenv/config";
// import pg from "pg";
import authRoutes from "./routes/auth.js";
import pageRoutes from "./routes/pages.js";


const __dirname = dirname(fileURLToPath(import.meta.url))

// const db = new pg.Client({
//     user: process.env.DB_USER,
//     host: process.env.DB_HOST,
//     database: process.env.DB_NAME,
//     password: process.env.DB_PASSWORD,
//     port: process.env.DB_PORT,
// });

// db.connect((err, res) => {
//     if (err) {
//         console.log("Error connecting to the database", err)
//     } else {
//         console.log("Database connection is successful")
//     }
    
// });



const app = express();
const PORT = 3000;


app.use(bodyParser.urlencoded({ extended: true}));
app.use(express.static("public"))


// Connect to DB
connectDB();

// Routes
app.use("/", pageRoutes);
app.use("/", authRoutes);

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
