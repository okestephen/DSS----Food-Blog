import { hashData } from "./utils/hashData";


async function loginUSer(email, password) {
    try {
        const user = await findUser(username);
        if (!user) {
            return false;  // User not found
        }

        // Check Password
        const passwordMatch = await comparePasswords(password, user.password);
        if (!passwordMatch) {
            return false; // Invalid password
        }
        // Create session or token
        await createSession(user);
        return true; // Successful login
    } catch (error) {
        console.error(error);
        return false; // Handle errors
    }
}

const authenticateUser = async (data) => {
    try {
        const {email, password } = data;

    } catch (error) {

    }
}

const createUser = async (data) => {
    try {
        const {fname, lname, password, email, phone=null} = data

        //Checking if user already exists
        const existingUser = await User.findOne({email});

        if (existingUser) {
            throw Error("User with the provided email already exists");
        }

        // hash password
        const hashedPassword = await hashData(password);
        
    }
}

const cleanup = (data) => {
    data = data.charAt(0).toUpperCase() + data.slice(1)
    return data.trim()
}