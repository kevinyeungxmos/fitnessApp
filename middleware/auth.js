const jwt = require("jsonwebtoken");

const checkLogin = (req, res, next) => {
    const token = req.cookies.token
    if (!token) {
        req.email = ""
        return next()
    }
    try {
        const payload = jwt.verify(token, "SECRET");
        if (payload) {
            req.email = payload.email;
            console.log(req.email)
            return next();
        } else {
            return next()
        }
    } catch (error) {
        return next()
    }
};

// export custom middleware
module.exports = {
    checkLogin,
}