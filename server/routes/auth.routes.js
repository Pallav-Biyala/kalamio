import { Router } from 'express';
import passport from 'passport';
import asyncHandler from '../middleware/asyncHandler.js';
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
import { authLimiter, otpLimiter } from '../middleware/rateLimiter.js';
import { verifyJWT } from '../middleware/auth.js';

const router = Router();

// ── Public routes (no JWT required) ──────────────
router.post("/signup",          authLimiter, asyncHandler(signup));
router.post("/signin",          authLimiter, asyncHandler(signin));
router.post("/verify-email",    otpLimiter,  asyncHandler(verifyEmail));
router.post("/resend-otp",      otpLimiter,  asyncHandler(resendOtp));
router.post("/forgot-password", otpLimiter,  asyncHandler(forgotPassword));
router.post("/reset-password",  authLimiter, asyncHandler(resetPassword));
router.post("/refresh-token",   authLimiter, asyncHandler(refreshToken));

// ── Google OAuth 2.0 (server-side redirect flow) ──
router.get("/auth/google", googleAuthRedirect);
router.get("/auth/google/callback", googleAuthCallback);
router.post("/exchange-auth-code", authLimiter, asyncHandler(exchangeAuthCode));

// ── Protected routes (JWT required) ──────────────
router.post("/change-password", verifyJWT, asyncHandler(changePassword));
router.post("/logout",          verifyJWT, asyncHandler(logout));

export default router;
