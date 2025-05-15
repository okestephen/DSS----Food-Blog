const IDLE_TIMEOUT = 1000 * 60 * 15; // 15 minutes

export function validateSession(req, res, next) {
    const now = Date.now();

    if (req.session.user) {
        const userAgentChanged = req.session.ua !== req.get("User-Agent");
        const ipChanged = req.session.ip !== req.ip;
        const lastActivity = req.session.lastActivity || now;
        const idleTooLong = now - lastActivity > IDLE_TIMEOUT;

        if (userAgentChanged || ipChanged || idleTooLong) {
            req.session.destroy(() => {
                let reason = '';
                if (userAgentChanged || ipChanged) reason = 'integrity=1';
                else if (idleTooLong) reason = 'timeout=1';

                return res.redirect(`/login?${reason}`);
            });
        } else {
            req.session.lastActivity = now; // Update last activity
            next();
        }
    } else {
        next();
    }
}
