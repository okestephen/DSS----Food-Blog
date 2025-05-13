export async function logOtpAction(db, userId, action, req){
    const ip = req.ip;
    const ua = req.get("User-Agent");

    await db.query(
        `INSERT INTO otp_logs(user_id, action, ip_address, user_agent)
        VALUES ($1, $2, $3, $4)`,
        [userId, action, ip, ua]
    );
    
}