// routes/recipes.js
import express from "express";
import path from "path";
import multer from "multer";
// Use the named export "db" from connect.js
import { db as pool } from "../db/connect.js";

const router = express.Router();

router.get("/", (req, res) => {
    res.render("index");     // will load views/index.ejs
});

router.get("/profile", (req, res) => {
    res.render("user-profile"); // will load views/user-profile.ejs
});
 

router.get("/about", (req, res) => {
    res.render("about");     // will load views/about.ejs
});

// Multer setup: save uploads into public/uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join("public", "uploads")),
  filename: (req, file, cb) =>
    cb(null, `recipe_${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage });

router.get("/submit", (req, res) => {
    res.render("submit");    // will load views/submit.ejs
});

// ── CREATE: Handle submission of a new recipe ────────────────────────────────
router.post("/submit", upload.single("main_image"), async (req, res) => {
  try {
    const { title, description, prep_time, cook_time, servings } = req.body;

    const ingredients = Array.isArray(req.body.ingredients)
      ? req.body.ingredients
      : [req.body.ingredients];

    const steps = Array.isArray(req.body.steps)
      ? req.body.steps
      : [req.body.steps];

    const main_image = req.file.filename;

    const { rows } = await pool.query(
      `INSERT INTO recipes
         (title, description, ingredients, steps,
          prep_time, cook_time, servings, main_image, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       RETURNING id;`,
      [
        title,
        description,
        ingredients,
        steps,
        parseInt(prep_time),
        parseInt(cook_time),
        parseInt(servings),
        main_image
      ]
    );

    res.redirect(`/recipe/${rows[0].id}`);
  } catch (err) {
    console.error(err);
    res.render("submit.ejs", {
      recipe: req.body,
      editing: false,
      error: "Failed to submit recipe."
    });
  }
});

// ── READ: Browse & Search ────────────────────────────────────────────────────
router.get("/browse", async (req, res) => {
  try {
    const { q } = req.query;
    let result;

    if (q) {
      result = await pool.query(
        `SELECT id, title, main_image
           FROM recipes
          WHERE title ILIKE $1 OR description ILIKE $1
       ORDER BY created_at DESC;`,
        [`%${q}%`]
      );
    } else {
      result = await pool.query(
        `SELECT id, title, main_image
           FROM recipes
       ORDER BY created_at DESC
          LIMIT 20;`
      );
    }

    res.render("browse.ejs", {
      recipes: result.rows,
      searchTerm: q || ""
    });
  } catch (err) {
    console.error(err);
    res.render("browse.ejs", {
      recipes: [],
      searchTerm: "",
      error: "Could not load recipes."
    });
  }
});

// ── READ: Show a Single Recipe ──────────────────────────────────────────────
router.get("/recipe/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM recipes WHERE id = $1;",
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).render("recipe.ejs", {
        recipe: null,
        error: "Recipe not found."
      });
    }

    res.render("recipe.ejs", {
      recipe: rows[0],
      error: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).render("recipe.ejs", {
      recipe: null,
      error: "Error loading recipe."
    });
  }
});

export default router;
