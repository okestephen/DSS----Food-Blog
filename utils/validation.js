export const cleanup = (data) => {
    data = data.charAt(0).toUpperCase() + data.slice(1);
    return data.trim()
};


export const isValidPassword = (password) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return passwordRegex.test(password);
};

export const passwordRequirementsMessage = () => {
    return "Password must include at least:\n- 1 uppercase letter;\n 1 lowercase letter;\n 1 digit;\n Minimum length of 8 characters.";
};

export const validateSignupInput = (fname, lname, email, password, passwordConf, phone) => {
    const emailregex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const nameregex = /^[a-zA-z-']*$/;
    const phoneRegex = /^\d{10,15}$/;

    if (!fname || !lname || !email || !password || !passwordConf) {
            throw Error("Empty input fields!")
        } else if (!isValidPassword(password)){
            throw Error(passwordRequirementsMessage());
        } else if (!nameregex.test(fname) || !nameregex.test(lname)) {
            throw Error("Invalid name entered");
        } else if (!emailregex.test(email)){
            throw Error("Invalid email address entered");
        } else if (passwordConf !== password){
            throw Error("Passwords do not match");
        }

        if (!phone || phone.trim() === "") {
            phone = null;
        } else if (!phoneRegex.test(phone)) {
            throw new Error("Invalid phone number")
        }
};

export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));