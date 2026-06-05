import { useEffect, useState } from 'react';

const CustomTooltip = () => {
    const [tooltipData, setTooltipData] = useState(null);

    useEffect(() => {
        let activeElement = null;
        let showTimer = null;

        const handleMouseOver = (e) => {
            const target = e.target.closest('[title], [data-tooltip]');
            if (!target) return;

            let text = target.getAttribute('title') || target.getAttribute('data-tooltip');
            if (!text || text.trim() === '') return;

            if (target.hasAttribute('title')) {
                target.setAttribute('data-tooltip', text);
                target.removeAttribute('title');
            }

            activeElement = target;

            clearTimeout(showTimer);
            const rect = target.getBoundingClientRect();
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            setTooltipData({
                text,
                x: rect.left + rect.width / 2,
                y: rect.bottom + 10,
                isLight
            });
        };

        const handleMouseOut = () => {
            clearTimeout(showTimer);
            setTooltipData(null);
            activeElement = null;
        };

        const hide = () => {
            clearTimeout(showTimer);
            setTooltipData(null);
        };

        document.addEventListener('mouseover', handleMouseOver);
        document.addEventListener('mouseout', handleMouseOut);
        window.addEventListener('scroll', hide, true);
        document.addEventListener('click', hide);
        document.addEventListener('mousedown', hide);

        return () => {
            clearTimeout(showTimer);
            document.removeEventListener('mouseover', handleMouseOver);
            document.removeEventListener('mouseout', handleMouseOut);
            window.removeEventListener('scroll', hide, true);
            document.removeEventListener('click', hide);
            document.removeEventListener('mousedown', hide);
        };
    }, []);

    if (!tooltipData) return null;

    const bg = tooltipData.isLight ? '#1a1a1a' : '#dadce0';
    const fg = tooltipData.isLight ? '#ffffff' : '#1f1f1f';

    return (
        <div
            style={{
                position: 'fixed',
                left: tooltipData.x,
                top: tooltipData.y,
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
                zIndex: 999999,
            }}
        >
            {/* Arrow */}
            <div
                style={{
                    width: 0,
                    height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderBottom: `6px solid ${bg}`,
                    margin: '0 auto',
                }}
            />
            {/* Pill */}
            <div
                style={{
                    backgroundColor: bg,
                    color: fg,
                    padding: '6px 16px',
                    borderRadius: '14px',
                    fontSize: '13px',
                    fontWeight: 500,
                    lineHeight: '20px',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Inter', 'DM Sans', sans-serif",
                }}
            >
                {tooltipData.text}
            </div>
        </div>
    );
};

export default CustomTooltip;
