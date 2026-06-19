import { Route, Routes } from "react-router-dom";
import MainLayout from "./components/main-layout.component";
import { createContext, useEffect, useState, lazy, Suspense } from "react";
import { lookInSession } from "./common/session";
import { Toaster } from 'react-hot-toast';
import Loader from "./components/loader.component";
import CustomTooltip from "./components/CustomTooltip";

// Lazy load all pages — only downloaded when the user navigates to them
const UserAuthForm = lazy(() => import("./pages/userAuthForm.page"));
const Editor = lazy(() => import("./pages/editor.pages"));
const HomePage = lazy(() => import("./pages/home.page"));
const ReadsPage = lazy(() => import("./pages/reads.page"));
const SearchPage = lazy(() => import("./pages/search.page"));
const PageNotFound = lazy(() => import("./pages/404.page"));
const ProfilePage = lazy(() => import("./pages/profile.page"));
const BlogPage = lazy(() => import("./pages/blog.page"));
const ChangePassword = lazy(() => import("./pages/change-password.page"));
const EditProfile = lazy(() => import("./pages/edit-profile.page"));
const Notifications = lazy(() => import("./pages/notifications.page"));
const ManageBlogs = lazy(() => import("./pages/manage-blogs.page"));
const ConnectionsPage = lazy(() => import("./pages/connections.page"));
const PublicationPage = lazy(() => import("./pages/publication.page"));
const CreatePublicationPage = lazy(() => import("./pages/create-publication.page"));
const EditPublicationPage = lazy(() => import("./pages/edit-publication.page"));
const ManagePublicationsPage = lazy(() => import("./pages/manage-publications.page"));
const BookmarksPage = lazy(() => import("./pages/bookmarks.page"));
const DraftsPage = lazy(() => import("./pages/drafts.page"));
const YouPage = lazy(() => import("./pages/you.page"));
const NotificationPreferences = lazy(() => import("./pages/notification-preferences.page"));
const AnalyticsPage = lazy(() => import("./pages/analytics.page"));
const BlockedUsersPage = lazy(() => import("./pages/blocked-users.page"));
const AccountManagementPage = lazy(() => import("./pages/account-management.page"));
const PrivacySettingsPage = lazy(() => import("./pages/privacy-settings.page"));
const MessagesPage = lazy(() => import("./pages/messages.page"));
const AuthCallback = lazy(() => import("./pages/auth-callback.page"));
const VerifyOtp = lazy(() => import("./pages/verify-otp.page"));
const ForgotPassword = lazy(() => import("./pages/forgot-password.page"));
const ResetPassword = lazy(() => import("./pages/reset-password.page"));
const SubscriptionsPage = lazy(() => import("./pages/subscriptions.page"));
const CommentThreadPage = lazy(() => import("./pages/comment-thread.page"));

export const UserContext = createContext({});
export const ThemeContext = createContext({});

const App = () => {

    const [userAuth, setUserAuth] = useState({});
    const [theme, setTheme] = useState("dark");

    useEffect(() => {

        let userInSession = lookInSession("user");
        userInSession ? setUserAuth(JSON.parse(userInSession)) : setUserAuth({ access_token: null });

        // Restore saved theme (dark = default/no attr, light = explicit)
        let savedTheme = lookInSession("theme") || "dark";
        document.documentElement.classList.add("no-transition");
        if (savedTheme === "light") {
            document.documentElement.setAttribute("data-theme", "light");
        } else {
            document.documentElement.removeAttribute("data-theme");
        }
        setTheme(savedTheme);

        // Re-enable transitions after first paint
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.documentElement.classList.remove("no-transition");
            });
        });

        // Dismiss splash screen after a minimum display time
        const splash = document.getElementById("splash");
        if (splash) {
            const timer = setTimeout(() => {
                splash.classList.add("splash-hide");
                splash.addEventListener("transitionend", () => splash.remove(), { once: true });
            }, 1500);
            return () => clearTimeout(timer);
        }

    }, [])

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            <UserContext.Provider value={{userAuth, setUserAuth}}>
                <Toaster 
                    position="top-center"
                    toastOptions={{
                        duration: 3000,
                        style: {
                            background: theme === 'dark' ? '#2d2d2c' : '#fff',
                            color: theme === 'dark' ? '#f5f5f5' : '#0f0f0f',
                            border: `1px solid ${theme === 'dark' ? '#373735' : '#e6e6e6'}`,
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontFamily: "'DM Sans', sans-serif",
                            boxShadow: theme === 'dark' 
                                ? '0 10px 20px rgba(0,0,0,0.4)' 
                                : '0 10px 20px rgba(0,0,0,0.08)',
                        },
                    }}
                />
                <CustomTooltip />
                <Suspense fallback={<Loader />}>
                    <Routes>
                        <Route path="/editor" element={<Editor/>} />
                        <Route path="/editor/:blog_id" element={<Editor/>} />
                        <Route path="/" element={<MainLayout />} >
                            <Route index element={<HomePage />} />
                        <Route path="reads" element={<ReadsPage />} />
                            <Route path="dashboard/blogs" element={<ManageBlogs />} />
                            <Route path="dashboard/notifications" element={<Notifications />} />
                            <Route path="dashboard/connections" element={<ConnectionsPage />} />
                            <Route path="dashboard/publications" element={<ManagePublicationsPage />} />
                            <Route path="dashboard/create-publication" element={<CreatePublicationPage />} />
                            <Route path="dashboard/edit-publication/:slug" element={<EditPublicationPage />} />
                            <Route path="dashboard/bookmarks" element={<BookmarksPage />} />
                            <Route path="dashboard/drafts" element={<DraftsPage />} />
                            <Route path="settings/edit-profile" element={<EditProfile />} />
                            <Route path="settings/change-password" element={<ChangePassword />} />
                            <Route path="settings/notification-preferences" element={<NotificationPreferences />} />
                            <Route path="settings/blocked-users" element={<BlockedUsersPage />} />
                            <Route path="dashboard/analytics" element={<AnalyticsPage />} />
                            <Route path="settings/privacy" element={<PrivacySettingsPage />} />
                            <Route path="settings/account" element={<AccountManagementPage />} />
                            <Route path="you" element={<YouPage />} />
                            <Route path="signin" element={<UserAuthForm type="sign-in"/>} />
                            <Route path="signup" element={<UserAuthForm type="sign-up" />} />
                            <Route path="verify-otp" element={<VerifyOtp />} />
                            <Route path="forgot-password" element={<ForgotPassword />} />
                            <Route path="reset-password" element={<ResetPassword />} />
                            <Route path="search/:query" element={<SearchPage />} />
                            <Route path="user/:id" element={<ProfilePage />} />
                            <Route path="publication/:slug" element={<PublicationPage />} />
                            <Route path="subscriptions" element={<SubscriptionsPage />} />
                            <Route path="messages" element={<MessagesPage />} />
                            <Route path="blog/:blog_id" element={<BlogPage />} />
                            <Route path="comment/:comment_id" element={<CommentThreadPage />} />
                            <Route path="auth/callback" element={<AuthCallback />} />
                            <Route path="*" element={<PageNotFound />} />
                        </Route>
                        
                    </Routes>
                </Suspense>
            </UserContext.Provider>
        </ThemeContext.Provider>
    )
}

export default App;