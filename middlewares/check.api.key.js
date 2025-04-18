const apiKeyMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey){ return res.status(400).json({ message: 'API key is required' }); }
    // ToDo: or throw a 400 error if you want to hide it
    if (apiKey !== process.env.API_KEY){ return res.status(403).json({ message: 'Forbidden: Invalid API key' }); }
    next();
};

module.exports = apiKeyMiddleware;