//Required Modules
import express from "express";
import { dirname } from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
const __dirname = dirname(fileURLToPath(import.meta.url))


// Create environement and set Port
const app = express();
const PORT = 3000;


app.use(bodyParser.urlencoded({ extended: true}));
app.use(express.static("public"))

app.get("/", (req, res) => {
    res.render("index.ejs");
});

app.get("/browse", (req, res) => {
    res.render("browse.ejs");
});

app.get("/about", (req, res) => {
    res.render("about.ejs");
});

app.get("/profile", (req, res) => {
    res.render("user-profile.ejs");
});

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});
