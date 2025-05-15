// Ensures the user is authenticated using session information
export function ensureAuthenticated(req, res, next){
    if (req.session.user) {
        return next();
    }
    res.redirect("/login");
}