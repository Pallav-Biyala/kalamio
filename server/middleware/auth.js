import jwt from 'jsonwebtoken';
import { ERRORS } from '../constants/error-messages.js';
import { AUTH } from '../constants/auth.constants.js';

export const verifyJWT = (req, res, next) => {

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(" ")[1];

    if(token == null){
        return res.status(401).json({ error: ERRORS.UNAUTHORIZED });
    }
    
    jwt.verify(token, process.env.JWT_ACCESS_SECRET, { clockTolerance: AUTH.CLOCK_TOLERANCE_S }, (err, user) => {
        if(err){
            const message = err.name === 'TokenExpiredError'
                ? ERRORS.TOKEN_EXPIRED
                : ERRORS.TOKEN_INVALID;
            const status = err.name === 'TokenExpiredError' ? 401 : 403;
            return res.status(status).json({ error: message });
        }

        req.user = user.id
        next()
    })

};

/**
 * Optional JWT — sets req.user if valid token present, but doesn't block.
 * Used for endpoints that work for both authenticated and unauthenticated users
 * but show different data (e.g., "is_owner" flag on collections).
 */
export const optionalJWT = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(token, process.env.JWT_ACCESS_SECRET, { clockTolerance: AUTH.CLOCK_TOLERANCE_S }, (err, user) => {
        req.user = err ? null : user.id;
        next();
    });
};
