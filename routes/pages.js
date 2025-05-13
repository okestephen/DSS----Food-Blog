import express from "express";
import { ensureAuthenticated } from "../middleware/authMiddleware.js";
import { validateSessionIntegrity } from "../middleware/sessionIntegrity.js";
import { db } from "../db/connect.js";
import multer from "multer";
import path from "path";

// File storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join("public", "uploads")),
  filename: (req, file, cb) => cb(null, `recipe_${Date.now()}_${file.originalname}`)
});

const upload = multer({ storage });

const router = express.Router();

router.get("/", (req, res) => {
    res.render("index.ejs");
});

router.get("/submit", (req, res) => {
    res.render("submit.ejs", { editing: false, recipe: {} });
});

router.post("/submit-recipe", ensureAuthenticated, upload.fields([
  { name: "main_image", maxCount: 1 },
  { name: "extra_images", maxCount: 10 }
]), async (req, res) => {
  try {
    // Extract form fields from req.body
    const { title, description, prep_time, cook_time, servings, ingredients, steps, tags, video, allow_comments } = req.body;
    const ingredientsArray = Array.isArray(ingredients) ? ingredients : [ingredients];
    const stepsArray = Array.isArray(steps) ? steps : [steps];
    const tagArray = Array.isArray(tags) ? tags : [tags];
    const allowComments = allow_comments === "on";

    // Extract uploaded file info from req.files
    const mainImageFile = req.files.main_image[0];             // single main image file
    const mainImageName = mainImageFile.filename;              // e.g., "recipe_1634567890123_myphoto.jpg"
    const extraImagesFiles = req.files.extra_images || [];     // array of additional image files (if any)
    const extraImagesNames = extraImagesFiles.map(f => f.filename);  // array of filenames for extra images

    // Insert new recipe into the database, including the extra_images array
    const insertQuery = `
      INSERT INTO recipes 
        (user_id, title, description, ingredients, steps, prep_time, cook_time, servings, tags, main_image, extra_images, video_url, allow_comments, created_at)
      VALUES 
        ($1,     $2,    $3,          $4,          $5,    $6,        $7,        $8,       $9,   $10,        $11,         $12,      $13,           NOW());
    `;
    const values = [
      req.session.user.id,         // assuming user ID is stored in session
      title,
      description,
      ingredientsArray,
      stepsArray,
      parseInt(prep_time),
      parseInt(cook_time),
      parseInt(servings),
      tagArray,
      mainImageName,
      extraImagesNames,           // array of text filenames for extra_images
      video,
      allowComments
    ];
    await db.query(insertQuery, values);

    res.redirect("/browse");
  } catch (err) {
    console.error("Recipe submission failed:", err);
    // Re-render form with error (not shown for brevity)
    res.render("submit.ejs", { recipe: req.body, editing: false, error: "Failed to submit recipe." });
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
    res.render("recipe.ejs", { recipe });
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

    res.render("submit.ejs", { recipe, editing: true });
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
    const {
      title,
      description,
      prep_time,
      cook_time,
      servings,
      ingredients,
      steps,
      tags,
      video,
      allow_comments,
      delete_images = []
    } = req.body;

    const ingredientsArray = Array.isArray(ingredients) ? ingredients : [ingredients];
    const stepsArray = Array.isArray(steps) ? steps : [steps];
    const tagArray = Array.isArray(tags) ? tags : [tags];
    const allowComments = allow_comments === "on";
    const deleteImagesArray = Array.isArray(delete_images) ? delete_images : [delete_images];

    let updateQuery = `
      UPDATE recipes SET
        title = $1,
        description = $2,
        ingredients = $3,
        steps = $4,
        prep_time = $5,
        cook_time = $6,
        servings = $7,
        tags = $8,
        video_url = $9,
        allow_comments = $10`;

    const values = [
      title,
      description,
      ingredientsArray,
      stepsArray,
      parseInt(prep_time),
      parseInt(cook_time),
      parseInt(servings),
      tagArray,
      video,
      allowComments
    ];

    // Handle new main image if uploaded
    if (req.files.main_image && req.files.main_image.length > 0) {
      const newMainImage = req.files.main_image[0].filename;
      updateQuery += ", main_image = $" + (values.length + 1);
      values.push(newMainImage);
    }

    // Handle extra images
    let result = await db.query("SELECT extra_images FROM recipes WHERE recipe_id = $1", [req.params.id]);
    let existingImages = result.rows[0]?.extra_images || [];

    // Remove images marked for deletion
    const filteredImages = existingImages.filter(img => !deleteImagesArray.includes(img));

    // Add any new extra images
    if (req.files.extra_images && req.files.extra_images.length > 0) {
      const newImages = req.files.extra_images.map(f => f.filename);
      filteredImages.push(...newImages);
    }

    updateQuery += ", extra_images = $" + (values.length + 1);
    values.push(filteredImages);

    // WHERE clause
    updateQuery += " WHERE recipe_id = $" + (values.length + 1);
    values.push(req.params.id);

    await db.query(updateQuery, values);
    res.redirect(`/recipe/${req.params.id}`);

  } catch (err) {
    console.error("Error updating recipe:", err);
    res.status(500).send("Error updating recipe");
  }
});



router.post("/recipe/:id/delete", ensureAuthenticated, async (req, res) => {
  try {
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

router.get("/profile/:slug", ensureAuthenticated, validateSessionIntegrity, async (req, res) => {
    const {slug} = req.params;
    const result = await db.query(
        "SELECT * FROM users WHERE slug = $1",
        [slug]
    );

    if (result.rows.length === 0){
        return res.status(404).send("User not found")
    }

    const user = result.rows[0];

    // Block acess if slug isn't for logged-in user
    if (user.user_id !== req.session.user.id){
        res.status(403).send("Access Denied");
    }
    
    res.render("user-profile.ejs", {user});
});


router.get("/about", (req, res) => {
    res.render("about.ejs");
});

export default router;
