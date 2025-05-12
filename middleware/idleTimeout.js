const IDLE_TIMEOUT = 1000 * 60 * 1


// Logs user out after a certain duration of inactivity
export function idleTimout(req, res, next) {
    if (req.session.user) {
        const now = Date.now();

        const lastActivity = req.session.lastActivity || now;
        const elapsed = now - lastActivity;

        if (elapsed > IDLE_TIMEOUT) {
            // Destroy session if idle too long
            req.session.destroy(() => {
                return res.redirect("/login?timeout=1");
            });
        } else {
            // Update last Activity
            req.session.lastActivity = now;
            next();
        }
    } else {
        next();
    }
}