import { useContext, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { ThemeContext, UserContext } from "../App";
import LeftSidebar from "./left-sidebar.component";
import BottomTabBar from "./bottom-tab-bar.component";
import MobileTopBar from "./mobile-top-bar.component";
import UserNavigationPanel from "./user-navigation.component";
import Icon from "./Icon";
import Avatar from "./Avatar";
import api from "../common/api";
import { useEffect } from "react";

const MainLayout = () => {

    const { userAuth: { access_token, profile_img }, setUserAuth } = useContext(UserContext);
    const [userNavPanel, setUserNavPanel] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();
    const location = useLocation();
    const isReadsPage = location.pathname === "/reads";
    const isDashboardOrSettings = location.pathname.startsWith("/dashboard") || location.pathname.startsWith("/settings");

    // Check for new notifications
    useEffect(() => {
        if (access_token) {
            api.get("/new-notification")
                .then(({ data }) => {
                    setUserAuth(prev => ({ ...prev, ...data }));
                })
                .catch(() => {});
        }
    }, [access_token]);

    // YouTube-style mobile header & Desktop sticky composer scroll behavior
    useEffect(() => {
        let lastScrollY = window.scrollY;
        let headerOffset = 0;
        let ticking = false;
        let scrollUpAccum = 0;
        let isTouching = false; // track if finger is on screen
        const SCROLL_UP_THRESHOLD = 10;

        const onTouchStart = () => { isTouching = true; };
        const onTouchEnd = () => { isTouching = false; };

        const applyTransform = (offset) => {
            const isDesktop = window.innerWidth >= 1024;
            const transform = offset === 0 ? '' : `translateY(${-offset}px)`;

            if (isDesktop) {
                const topBar = document.querySelector('.mobile-top-bar');
                if (topBar) topBar.style.transform = '';
                const feedHeader = document.querySelector('.feed-sticky-header');
                if (feedHeader) feedHeader.style.transform = '';
            } else {
                const topBar = document.querySelector('.mobile-top-bar');
                const tabs = document.querySelector('.category-tabs');
                if (topBar) topBar.style.transform = transform;
                if (tabs) tabs.style.transform = transform;
                const feedHeader = document.querySelector('.feed-sticky-header');
                if (feedHeader) feedHeader.style.transform = '';
            }
        };

        const update = () => {
            const currentScrollY = window.scrollY;
            const delta = currentScrollY - lastScrollY;
            lastScrollY = currentScrollY;
            const isDesktop = window.innerWidth >= 1024;

            let maxOffset = 112;
            if (isDesktop) {
                const composer = document.querySelector('.composer-prompt');
                if (composer) {
                    const style = window.getComputedStyle(composer);
                    maxOffset = composer.offsetHeight + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
                } else {
                    maxOffset = 0;
                }
            }

            if (currentScrollY <= 5) {
                headerOffset = 0;
                scrollUpAccum = 0;
                applyTransform(0);
                document.body.classList.remove('scroll-down', 'scroll-up');
            } else if (delta > 0) {
                // Scrolling DOWN — always hide (even during momentum)
                scrollUpAccum = 0;
                if (maxOffset > 0) {
                    headerOffset = Math.min(headerOffset + delta, maxOffset);
                    applyTransform(headerOffset);
                    if (headerOffset >= maxOffset) {
                        document.body.classList.add('scroll-down');
                        document.body.classList.remove('scroll-up');
                    }
                }
            } else if (delta < 0) {
                // Scrolling UP
                if (maxOffset > 0) {
                    if (isDesktop) {
                        headerOffset = Math.max(headerOffset + delta, 0);
                        applyTransform(headerOffset);
                    } else if (isTouching) {
                        // Mobile: only reveal while finger is on screen
                        scrollUpAccum += Math.abs(delta);
                        if (scrollUpAccum >= SCROLL_UP_THRESHOLD) {
                            const cappedDelta = Math.max(delta, -3);
                            headerOffset = Math.max(headerOffset + cappedDelta, 0);
                            applyTransform(headerOffset);
                        }
                    }
                    // else: finger lifted → freeze header in place (do nothing)

                    if (headerOffset <= 0) {
                        document.body.classList.remove('scroll-down');
                        document.body.classList.add('scroll-up');
                    }
                }
            }

            ticking = false;
        };

        const handleScroll = () => {
            if (!ticking) {
                requestAnimationFrame(update);
                ticking = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchend', onTouchEnd, { passive: true });
        window.addEventListener('resize', () => {
            headerOffset = 0;
            applyTransform(0);
        });

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchend', onTouchEnd);
            applyTransform(0);
        };
    }, []);

    const handleSearchKeyDown = (e) => {
        if (e.keyCode === 13 && searchQuery.length) {
            navigate(`/search/${searchQuery}`);
        }
    };

    const handleSearchClick = () => {
        if (searchQuery.length) {
            navigate(`/search/${searchQuery}`);
        }
    };

    const handleBlur = () => {
        setTimeout(() => {
            setUserNavPanel(false);
        }, 300);
    };

    return (
        <div className="app-layout">
            {/* Desktop left sidebar — hidden on mobile */}
            <LeftSidebar />

            {/* Mobile top bar — hidden on desktop and on reads page */}
            {!isReadsPage && <MobileTopBar />}

            {/* Main content area */}
            <main className="app-layout__main">

                {/* Page content */}
                <div className={"app-layout__content" + (isDashboardOrSettings ? " app-layout__content--dashboard" : "")}>
                    <Outlet />
                </div>
            </main>

            {/* Mobile bottom tab bar — hidden on desktop */}
            <BottomTabBar />
        </div>
    );
};

export default MainLayout;
