import pg from "pg";
import "dotenv/config";

// Database environement 
export const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
})

export const connectDB = () => {
    db.connect((err, res) => {
        if (err) {
            console.log("Error connecting to the database", err)
        } else {
            console.log("Database connection is successful")
        }
    });
};


// module.exports = {
//     query: (text, params) => db.query(text, params),
// };