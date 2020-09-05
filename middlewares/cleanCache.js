const {clearHash} = require('../services/cache');
module.exports = (req,res,next) =>{
    await next();
    clearHash(req.user.id);
}