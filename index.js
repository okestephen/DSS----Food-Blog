// Required Modules
import express from "express";
import { dirname } from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import "dotenv/config";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "ug23_food_blog",
  password: process.env.DATABASE_PASSWORD,
  port: 5432,
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database", err); 
  } else {
    console.log("Database connection is successful");
  }
});


const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// Routes

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = $1 AND password = $2",
    [email, password],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.send("Login failed.");
      }

      if (result.rows.length > 0) {
        console.log("User logged in:", result.rows[0]);
        res.redirect("/profile");
      } else {
        res.send("Invalid email or password.");
      }
    }
  );
});

app.get("/signup", (req, res) => {
  res.render("signup.ejs", { passwordConf: null });
});

app.post("/signup", (req, res) => {
  const { fname, lname, email, password, passwordConf, phone } = req.body;

  if (password !== passwordConf) {
    return res.render("signup.ejs", {
      passwordConf: "Passwords do not match",
    });
  }

  db.query(
    "INSERT INTO users (first_name, last_name, email, password, phone) VALUES ($1, $2, $3, $4, $5)",
    [fname, lname, email, password, phone],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.send("Error during registration.");
      } else {
        console.log("User registered successfully!");
        res.redirect("/login");
      }
    }
  );
});

app.get("/submit", (req, res) => {
  res.render("submit.ejs");
});

app.post("/submit-recipe", (req, res) => {
  console.log(req.body);
  res.send("Recipe submitted.");
});

app.get("/browse", (req, res) => {
  res.render("browse.ejs");
});

app.get("/profile", (req, res) => {
  res.render("user-profile.ejs");
});

app.get("/about", (req, res) => {
  res.render("about.ejs");
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
