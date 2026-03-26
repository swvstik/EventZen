import { useCallback, useRef, useEffect } from 'react';

export default function ClickSpark({
  children,
  sparkColor = '#000000',
  sparkSize = 7,
  sparkRadius = 12,
  sparkCount = 8,
  duration = 300,
  easing = 'ease-out',
  extraScale = 1,
}) {
  const containerRef = useRef(null);

  const createSpark = useCallback((x, y) => {
    const colors = Array.isArray(sparkColor)
      ? sparkColor
      : [sparkColor, '#FFD600', '#E63946', '#4361EE'];

    for (let i = 0; i < sparkCount; i++) {
      const spark = document.createElement('div');
      const angle = (360 / sparkCount) * i;
      const velocity = sparkRadius + Math.random() * sparkRadius * 1.4;
      const size = Math.max(2, sparkSize - 2 + Math.random() * 3);
      const color = colors[Math.floor(Math.random() * colors.length)];

      spark.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 2px solid #1A1A2E;
        border-radius: 999px;
        pointer-events: none;
        z-index: 99999;
        transform: translate(-50%, -50%);
        box-shadow: 2px 2px 0 #1A1A2E;
      `;

      document.body.appendChild(spark);

      const rad = (angle * Math.PI) / 180;
      const dx = Math.cos(rad) * velocity;
      const dy = Math.sin(rad) * velocity;

      spark.animate(
        [
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
          {
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${extraScale})`,
            opacity: 0,
          },
        ],
        {
          duration,
          easing,
          fill: 'forwards',
        }
      ).onfinish = () => spark.remove();
    }
  }, [duration, easing, extraScale, sparkColor, sparkCount, sparkRadius, sparkSize]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleClick = (e) => {
      createSpark(e.clientX, e.clientY);
    };

    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [createSpark]);

  return (
    <div ref={containerRef} style={{ minHeight: '100vh' }}>
      {children}
    </div>
  );
}
