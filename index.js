//Required Modules
import express from "express";
import { dirname } from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import "dotenv/config";
// console.log("PROCESS.ENV LOG: ", process.env);
import pg from "pg";
const __dirname = dirname(fileURLToPath(import.meta.url))

// Database environement 
const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "UG23 Food Blog",
    password: process.env.DATABASE_PASSWORD,
    port: 5432,

})

db.connect((err, res) => {
    if (err) {
        console.err("Error connecting to the database", err)
    } else {
        console.log("Database connection is successful")
    }
    
});

db.query("SELECT * FROM users", (err, res) => {
    if (err) {
        console.error("Error executing query", err.stack);
    } else {
        let data = res.body;
    }
    db.end();
})


// Create environement and set Port
const app = express();
const PORT = 3000;


app.use(bodyParser.urlencoded({ extended: true}));
app.use(express.static("public"))


// Routes

app.get("/", (req, res) => {
    res.render("index.ejs", 
    //     {
    //         featured_title: "Creme Brulee",
    //         featured_desc: "This is a creme brulee",
    //         featured_image: "<style> .hero-section { background-image: url(\"creme-brulee.png\");}</style>"
    //     }
    );
});

app.get("/login", (req, res) => {
    res.render("login.ejs");
});

app.get("/submit", (req, res) => {
    res.render("submit.ejs");
});

app.post("/submit-recipe", (req, res) => {
    console.log(res.body)
})

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
