import pkg from "pg";
import "dotenv/config";

const { Pool } = pkg;

// Database environement 
export const db = new Pool({
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


/* 
query model:
const name_of_query = {
    text: SQL QUERY,
    values: [variables to be entered]
}
const entry = await db.query(name_of_query);

example: 
const registerUser = {
    text: "INSERT INTO users(firstname, lastname, password, email, phonenum) VALUES($1, $2, $3, $4, $5) RETURNING userid",
    values: [fname, lname, hashedPassword, email, phone],
};
const newEntry = await db.query(registerUser);
*/