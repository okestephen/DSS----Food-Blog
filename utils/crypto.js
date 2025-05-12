import bcrypt from "bcrypt";

const PEPPER  = process.env.PEPPER;

export async function hashPassword(password) {
    return bcrypt.hash(password + PEPPER, 10);
    
}

export async function verifyPassword(input, hash) {
    return bcrypt.compare(input + PEPPER, hash);
}