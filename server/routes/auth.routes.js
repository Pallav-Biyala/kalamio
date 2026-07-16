import { Router } from 'express';
import passport from 'passport';
import asyncHandler from '../middleware/asyncHandler.js';
import validate from '../middleware/validate.js';
import {
    signupSchema,
    signinSchema,
    verifyEmailSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
} from '../validators/schemas.js';
import {
    signup,
    signin,
    googleAuthRedirect,
    googleAuthCallback,
    exchangeAuthCode,
    verifyEmail,
    resendOtp,
    forgotPassword,
    resetPassword,
    refreshToken,
    logout,
    changePassword,
} from '../controllers/auth.controller.js';
import { authLimiter, otpLimiter, refreshLimiter } from '../middleware/rateLimiter.js';
import { verifyJWT } from '../middleware/auth.js';

const router = Router();

// ── Public routes (no JWT required) ──────────────
router.post("/signup",          authLimiter, validate(signupSchema),          asyncHandler(signup));
router.post("/signin",          authLimiter, validate(signinSchema),          asyncHandler(signin));
router.post("/verify-email",    otpLimiter,  validate(verifyEmailSchema),     asyncHandler(verifyEmail));
router.post("/resend-otp",      otpLimiter,                                   asyncHandler(resendOtp));
router.post("/forgot-password", otpLimiter,  validate(forgotPasswordSchema),  asyncHandler(forgotPassword));
router.post("/reset-password",  authLimiter, validate(resetPasswordSchema),   asyncHandler(resetPassword));
router.post("/refresh-token",   refreshLimiter,                                asyncHandler(refreshToken));

// ── Google OAuth 2.0 (server-side redirect flow) ──
router.get("/auth/google", googleAuthRedirect);
router.get("/auth/google/callback", googleAuthCallback);
router.post("/exchange-auth-code", authLimiter, asyncHandler(exchangeAuthCode));

// ── Protected routes (JWT required) ──────────────
router.post("/change-password", verifyJWT, validate(changePasswordSchema), asyncHandler(changePassword));
// /logout self-authenticates on the presented refresh token (or a Bearer access token for old
// clients), so an expired access token at sign-out can't 401 before the session is revoked.
router.post("/logout",          refreshLimiter, asyncHandler(logout));

export default router;
