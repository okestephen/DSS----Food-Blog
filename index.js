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

app.get("/new-recipe", (req, res) => {
    res.render("new-recipe.ejs");
});

app.post("/submit-recipe", (req, res) => {
    console.log(res.body)
})

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});
