export function validateSessionIntegrity(req, res, next){
    if (
        req.session.user &&
        (req.session.ua !== req.get("User-Agent") || req.session.ip !== req.ip)
    ) {
        req.session.destroy(() => {
            return res.redirect("/login");
        });
    } else {
        next();
    }
}