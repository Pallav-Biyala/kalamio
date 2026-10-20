import passport from 'passport';
import googleStrategy from '../strategies/google.strategy.js';

/**
 * Initialize Passport with configured strategies.
 * Call this in server.js BEFORE mounting routes.
 *
 * Note: We don't use passport sessions (serialize/deserialize)
 * because we use JWT tokens instead of server-side sessions.
 */
export const initializePassport = (app) => {
    if (googleStrategy) {
        passport.use(googleStrategy);
    } else {
        console.warn('⚠️  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google sign-in disabled');
    }
    app.use(passport.initialize());
};

export default passport;
