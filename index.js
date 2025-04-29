// Required Modules
import express from "express";
import { dirname } from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import "dotenv/config";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url))

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "ug23_food_blog",
    password: process.env.DATABASE_PASSWORD,
    port: 5432,

})

db.connect((err, res) => {
    if (err) {
        console.log("Error connecting to the database", err)
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
})


const app = express();
const PORT = 3000;


app.use(bodyParser.urlencoded({ extended: true}));
app.use(express.static("public"))



// Routes

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.post("/login", async (req, res) => {
   try {
    let { email, password } = req.body;
    email = email.trim();
    password = password.trim();

    if (!(email && password)) {
        throw Error("Empty credentials supplied!");
    }
   } catch (error) {

   }
});

app.get("/signup", (req, res) => {
  res.render("signup.ejs", { passwordConf: null });
});

app.post("/signup", async (req, res) => {
    try {
        let {fname, lname, email, password, passwordConf, phone} = req.body

        const passwordregex = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$"
        const emailregex = "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$";
        const nameregex = "^[a-zA-z-']*$"
        fname = cleanup(fname);
        lname = cleanup(lname)
        email = email.trim()
        password = password.trim()
        passwordConf = passwordConf.trim()
        
        if (!(fname && lname && email && password && passwordConf)) {
            throw Error("Empty input fields!")
        } else if (!passwordregex.test(password)){
            throw Error("Password does not fit the requirements")
        } else if (!nameregex.test(fname) && (!nameregex.test(lname))) {
            throw Error("Invalid name entered")
        } else if (!emailregex.test(email)){
            throw Error("Invalid email address entered")
        } else if (passwordConf == password){
            throw Error("Passwords do not match")
        } else {
            //
        }
    } catch (error) {

    }
    

    
    
    
    
})

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
