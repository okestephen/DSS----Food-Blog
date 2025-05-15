import express from "express";
import { ensureAuthenticated } from "../middleware/authMiddleware.js";
import { validateSession } from "../middleware/sessionIntegrity.js";
import { db } from "../db/connect.js";
import multer from "multer";
import path from "path";
import { decryptInfo } from "../utils/crypto.js";
import { escapeHTML } from "../utils/sanitize.js"; // Manual XSS mitigation
import crypto from "crypto";

if (!process.env.ENCRYPTION_KEY) {
  throw new Error("Missing ENCRYPTION_KEY in environment variables.");
}
const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY, "hex");

// File storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join("public", "uploads")),
  filename: (req, file, cb) => cb(null, `recipe_${Date.now()}_${file.originalname}`)
});

const upload = multer({ storage });

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const getRecipes = await db.query(
      `SELECT recipe_id, slug, title, description, main_image
        FROM recipes
        WHERE main_image IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 5;
      `
    );
    const featuredRecipes = getRecipes.rows;

    res.render("index.ejs", { featuredRecipes });
  } catch (err) {
    console.error("Error fetching featured recipes:", err);
    res.render("index.ejs", { featuredRecipes: [] });
  }
});


router.get("/submit", ensureAuthenticated, (req, res) => {
  const csrfToken = crypto.randomBytes(32).toString("hex");
  req.session.csrfToken = csrfToken;
  res.render("submit.ejs", { csrfToken, editing: false, recipe: {} });
});

router.post("/submit-recipe", ensureAuthenticated, upload.fields([
  { name: "main_image", maxCount: 1 },
  { name: "extra_images", maxCount: 10 }
]), async (req, res) => {
  try {

    // CSRF Validation
    const submittedToken = req.body.csrfToken;
    const sessionToken = req.session.csrfToken;
    

    if (!submittedToken || submittedToken !== sessionToken) {
      return res.status(403).send("Invalid CSRF token.");
    }

    const { title, description, prep_time, cook_time, servings, ingredients, steps, tags, video, allow_comments } = req.body;
    const ingredientsArray = (Array.isArray(ingredients) ? ingredients : [ingredients]).map(escapeHTML);
    const stepsArray = (Array.isArray(steps) ? steps : [steps]).map(escapeHTML);
    let tagArray = [];
    if (tags) {
      tagArray = (Array.isArray(tags) ? tags : [tags]).map(escapeHTML);
    }
    const cleanTitle = escapeHTML(title);
    const cleanDescription = escapeHTML(description);
    const cleanVideo = video ? escapeHTML(video) : "";
    const allowComments = allow_comments === "on";
    const mainImageName = req.files.main_image[0].filename;
    const extraImagesNames = (req.files.extra_images || []).map(f => f.filename);

    await db.query(`
      INSERT INTO recipes
      (user_id, title, description, ingredients, steps, prep_time, cook_time, servings, tags, main_image, extra_images, video_url, allow_comments, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())`,
      [
        req.session.user.id,
        cleanTitle,
        cleanDescription,
        ingredientsArray,
        stepsArray,
        parseInt(prep_time),
        parseInt(cook_time),
        parseInt(servings),
        tagArray,
        mainImageName,
        extraImagesNames,
        cleanVideo,
        allowComments
      ]
    );
    
    delete req.session.csrfToken;

    res.redirect("/browse");
  } catch (err) {
    console.error("Recipe submission failed:", err);

    const csrfToken = crypto.randomBytes(32).toString("hex");
    req.session.csrfToken = csrfToken;

    res.render("submit.ejs", {
      recipe: req.body,
      csrfToken, // repopulate token in form
      editing: false,
      error: "Failed to submit recipe."
    });
  }
});

router.get("/recipe/:id", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM recipes WHERE recipe_id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Recipe not found");
    }

    const recipe = result.rows[0];
    let csrfToken = null;
    if (req.session.user && req.session.user.id === recipe.user_id) {
      csrfToken = crypto.randomBytes(32).toString("hex");
      req.session.csrfToken = csrfToken;
    }

    res.render("recipe.ejs", { recipe, csrfToken });
  } catch (err) {
    console.error("Error loading recipe:", err);
    res.status(500).send("Server error");
  }
});

router.get("/recipe/:id/edit", ensureAuthenticated, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM recipes WHERE recipe_id = $1", [req.params.id]);
    const recipe = result.rows[0];

    if (!recipe || recipe.user_id !== req.session.user.id) {
      return res.status(403).send("Not authorized to edit this recipe");
    }

    const csrfToken = crypto.randomBytes(32).toString("hex");
    req.session.csrfToken = csrfToken;

    res.render("submit.ejs", { recipe, editing: true, csrfToken });
  } catch (err) {
    console.error("Edit GET failed:", err);
    res.status(500).send("Failed to load edit page");
  }
});

router.post("/recipe/:id/edit", ensureAuthenticated, upload.fields([
  { name: "main_image", maxCount: 1 },
  { name: "extra_images", maxCount: 10 }
]), async (req, res) => {
  try {

    // CSRF validation
    const submittedToken = req.body.csrfToken;
    const sessionToken = req.session.csrfToken;
    if (!submittedToken || submittedToken !== sessionToken) {
      return res.status(403).send("Invalid CSRF token.");
    }
    delete req.session.csrfToken; // Only delete after passing validation

    const result = await db.query("SELECT * FROM recipes WHERE recipe_id = $1", [req.params.id]);
    const recipe = result.rows[0];
    if (!recipe || recipe.user_id !== req.session.user.id) return res.status(403).send("Not authorized");

    const {
      title, description, prep_time, cook_time, servings,
      ingredients, steps, tags, video, allow_comments,
      delete_images = []
    } = req.body;

    const ingredientsArray = (Array.isArray(ingredients) ? ingredients : [ingredients]).map(escapeHTML);
    const stepsArray = (Array.isArray(steps) ? steps : [steps]).map(escapeHTML);
    let tagArray = [];
      if (tags) {
        tagArray = (Array.isArray(tags) ? tags : [tags]).map(escapeHTML);
      }
    const cleanTitle = escapeHTML(title);
    const cleanDescription = escapeHTML(description);
    const cleanVideo = video ? escapeHTML(video) : "";
    const allowComments = allow_comments === "on";
    const deleteImagesArray = Array.isArray(delete_images) ? delete_images : [delete_images];

    let updateQuery = `
      UPDATE recipes SET
      title = $1, description = $2, ingredients = $3, steps = $4,
      prep_time = $5, cook_time = $6, servings = $7, tags = $8,
      video_url = $9, allow_comments = $10`;
    const values = [
      cleanTitle,
      cleanDescription,
      ingredientsArray,
      stepsArray,
      parseInt(prep_time),
      parseInt(cook_time),
      parseInt(servings),
      tagArray,
      cleanVideo,
      allowComments
    ];

    if (req.files.main_image?.length > 0) {
      updateQuery += `, main_image = $${values.length + 1}`;
      values.push(req.files.main_image[0].filename);
    }

    const currentImages = recipe.extra_images || [];
    const filteredImages = currentImages.filter(img => !deleteImagesArray.includes(img));
    if (req.files.extra_images?.length > 0) {
      const newImages = req.files.extra_images.map(f => f.filename);
      filteredImages.push(...newImages);
    }

    updateQuery += `, extra_images = $${values.length + 1}`;
    values.push(filteredImages);
    updateQuery += ` WHERE recipe_id = $${values.length + 1}`;
    values.push(req.params.id);

    await db.query(updateQuery, values);
    res.redirect(`/recipe/${req.params.id}`);
  } catch (err) {
    console.error("Error updating recipe:", err);
    const newToken = crypto.randomBytes(32).toString("hex");
    req.session.csrfToken = newToken;
    
    return res.render("submit.ejs", {
      recipe: req.body,
      editing: true,
      csrfToken: newToken,
      error: "Error updating recipe"
    });
  }
});



router.post("/recipe/:id/delete", ensureAuthenticated, async (req, res) => {

  const submittedToken = req.body.csrfToken;
  const sessionToken = req.session.csrfToken;
  delete req.session.csrfToken;

  if (!submittedToken || submittedToken !== sessionToken) {
    return res.status(403).send("Invalid CSRF token.");
  }

  try {
    const result = await db.query("SELECT * FROM recipes WHERE recipe_id = $1", [req.params.id]);
    const recipe = result.rows[0];

    if (!recipe || recipe.user_id !== req.session.user.id) {
      return res.status(403).send("Not authorized to edit this recipe");
    }
    await db.query("DELETE FROM recipes WHERE recipe_id = $1 AND user_id = $2", [
      req.params.id,
      req.session.user.id
    ]);
    res.redirect("/browse");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting recipe");
  }
});


router.get("/browse", async (req, res) => {
  try {
    const searchTerm = req.query.q;
    let result;

    if (searchTerm) {
      result = await db.query(
        `SELECT recipe_id, title, main_image FROM recipes WHERE
         title ILIKE $1 OR description ILIKE $1 ORDER BY created_at DESC`,
        [`%${searchTerm}%`]
      );
    } else {
      result = await db.query(
        `SELECT recipe_id, title, main_image FROM recipes ORDER BY created_at DESC LIMIT 20`
      );
    }

    res.render("browse.ejs", {
      recipes: result.rows,
      searchTerm
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

router.get("/profile/:slug", ensureAuthenticated, validateSession, async (req, res) => {
    const {slug} = req.params;

    // Block acess if slug isn't for logged-in user
    if (slug !== req.session.user.slug){
      return res.redirect("/login");
    }

    const result = await db.query(
        "SELECT * FROM users WHERE slug = $1",
        [slug]
    );

    if (result.rows.length === 0){
        return res.status(404).send("User not found")
    }

    const user = result.rows[0];

    const decrypted = decryptInfo({
      firstname: user.first_name,
      lastname: user.last_name,
      email: user.email,
      phone: user.phone
    }, encryptionKey);

    let recipes = await db.query(`
      SELECT recipe_id, title, main_image FROM recipes WHERE
      user_id = $1`,
      [user.user_id]
    );


    
    res.render("user-profile.ejs", {
      user: {
      ...user,
      first_name: decrypted.firstname,
      last_name: decrypted.lastname,
      email: decrypted.email,
      phone: decrypted.phone
    },
      recipes: recipes.rows});
});


router.get("/about", (req, res) => {
    res.render("about.ejs");
});

export default router;