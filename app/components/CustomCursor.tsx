'use client';

import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function CustomCursor() {
  const [mounted, setMounted] = useState(false);
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  
  const springConfig = { damping: 30, stiffness: 350, mass: 0.5 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  useEffect(() => {
    // Detect mobile and touch-capable devices to bypass custom cursor entirely
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(max-width: 768px)').matches;
    if (isTouchDevice) {
      setMounted(false);
      return;
    }

    setMounted(true);
    
    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };

    window.addEventListener('mousemove', moveCursor);

    // Clean up body hover classes on mount
    document.body.classList.remove('cursor-hover', 'cursor-image', 'cursor-heading', 'cursor-clicked');

    // Robust Event Delegation for dynamic Next.js components
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const isHover = target.closest('a, button, [data-cursor="hover"], .cursor-pointer, input, textarea, select');
      const isImg = target.closest('img, [data-cursor="image"], .cursor-image-hover');
      const isHeading = target.closest('h1, h2, h3, h4, .font-heading, [data-cursor="heading"]');

      // Enforce mutual exclusivity to prevent CSS transition glitches
      document.body.classList.remove('cursor-hover', 'cursor-image', 'cursor-heading');

      if (isHover) {
        document.body.classList.add('cursor-hover');
      } else if (isImg) {
        document.body.classList.add('cursor-image');
      } else if (isHeading) {
        document.body.classList.add('cursor-heading');
      }
    };

    window.addEventListener('mouseover', handleMouseOver);

    // Compress on click
    const handleMouseDown = () => {
      document.body.classList.add('cursor-clicked');
    };
    const handleMouseUp = () => {
      document.body.classList.remove('cursor-clicked');
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('cursor-hover', 'cursor-image', 'cursor-heading', 'cursor-clicked');
    };
  }, [cursorX, cursorY]);

  if (!mounted) return null;

  return (
    <>
      <motion.div
        id="cursor-outer"
        style={{
          left: cursorXSpring,
          top: cursorYSpring,
          translateX: '-50%',
          translateY: '-50%',
        }}
      />
      <motion.div
        id="cursor-inner"
        style={{
          left: cursorX,
          top: cursorY,
          translateX: '-50%',
          translateY: '-50%',
        }}
      />
    </>
  );
}
