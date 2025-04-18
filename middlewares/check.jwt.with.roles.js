const jwt = require("jsonwebtoken");

const EResultCodes = require("../enums/EResultCodes.js");

exports.checkEligibility = (roleLevel) => {
    return async (req, res, next) => {
      try {
        const { authorization } = req.headers;
        if(!authorization){ return res.status(EResultCodes.BAD_REQUEST).send("Please authanticate yourself first."); }
        const token = authorization.split(' ')[1];
        const user = await jwt.verify(token, process.env.JWT_SECRET_KEY);
        if (user.role < roleLevel) { return res.status(403).send('You are not authorised to use this service.'); }
        req.user = user;
        next();
      } catch (error) {
        console.log('checkEligibility error: '+ error)
        return res.status(EResultCodes.BAD_REQUEST).send("Your token is invalid or expired.");
      } 
    }
}

// ToDo: add a filtering option.
// If the given roleLevel is 1 or higher, so we can return 400 instead of 403
// Public routes may stay as they are.