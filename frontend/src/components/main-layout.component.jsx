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
        let scrollUpAccum = 0; // accumulates scroll-up pixels before revealing
        const SCROLL_UP_THRESHOLD = 10; // ignore small scroll-ups from browser chrome

        const applyTransform = (offset) => {
            const isDesktop = window.innerWidth >= 1024;
            const transform = offset === 0 ? '' : `translateY(${-offset}px)`;

            if (isDesktop) {
                // Clear mobile transforms just in case
                const topBar = document.querySelector('.mobile-top-bar');
                if (topBar) topBar.style.transform = '';
                
                // Clear desktop transform so it stays perfectly sticky at top: 0
                const feedHeader = document.querySelector('.feed-sticky-header');
                if (feedHeader) feedHeader.style.transform = '';
            } else {
                // On mobile, hide the top bar and category tabs together
                const topBar = document.querySelector('.mobile-top-bar');
                const tabs = document.querySelector('.category-tabs');
                
                if (topBar) topBar.style.transform = transform;
                if (tabs) tabs.style.transform = transform;
                
                // Clear desktop transform just in case
                const feedHeader = document.querySelector('.feed-sticky-header');
                if (feedHeader) feedHeader.style.transform = '';
            }
        };

        const update = () => {
            const currentScrollY = window.scrollY;
            const delta = currentScrollY - lastScrollY;
            lastScrollY = currentScrollY;
            const isDesktop = window.innerWidth >= 1024;

            // Determine max offset dynamically
            let maxOffset = 112; // default mobile maxOffset (57px header + ~55px tabs)
            if (isDesktop) {
                const composer = document.querySelector('.composer-prompt');
                if (composer) {
                    const style = window.getComputedStyle(composer);
                    maxOffset = composer.offsetHeight + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
                } else {
                    maxOffset = 0; // If no composer, nothing needs to scroll away
                }
            }

            if (currentScrollY <= 5) {
                headerOffset = 0;
                scrollUpAccum = 0;
                applyTransform(0);
                document.body.classList.remove('scroll-down', 'scroll-up');
            } else if (delta > 0) {
                // Scrolling DOWN — reset scroll-up accumulator
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
                // Scrolling UP — accumulate first, then reveal after threshold
                if (maxOffset > 0) {
                    if (isDesktop) {
                        // Desktop: no browser chrome interference, track directly
                        headerOffset = Math.max(headerOffset + delta, 0);
                        applyTransform(headerOffset);
                    } else {
                        // Mobile: dampen scroll-up to counteract browser chrome inflation
                        scrollUpAccum += Math.abs(delta);
                        if (scrollUpAccum >= SCROLL_UP_THRESHOLD) {
                            // Reveal at 40% of scroll speed for gradual appearance
                            const dampenedDelta = delta * 0.4;
                            headerOffset = Math.max(headerOffset + dampenedDelta, 0);
                            applyTransform(headerOffset);
                        }
                    }
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
        // Handle window resize to reset transforms when crossing breakpoint
        window.addEventListener('resize', () => {
            headerOffset = 0;
            applyTransform(0);
        });

        return () => {
            window.removeEventListener('scroll', handleScroll);
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
