/**
 * iOS-Level Animation System
 * Spring physics and natural easing for buttery-smooth 60fps animations
 */

// Spring presets matching iOS animations
export const spring = {
  // Default spring - fast and snappy like iOS buttons
  default: {
    type: "spring" as const,
    stiffness: 400,
    damping: 30,
    mass: 1,
  },
  // Gentle spring - for page transitions
  gentle: {
    type: "spring" as const,
    stiffness: 300,
    damping: 35,
    mass: 1,
  },
  // Bouncy spring - for playful interactions
  bouncy: {
    type: "spring" as const,
    stiffness: 500,
    damping: 25,
    mass: 1,
  },
  // Stiff spring - for instant feedback
  stiff: {
    type: "spring" as const,
    stiffness: 600,
    damping: 40,
    mass: 0.8,
  },
  // Smooth spring - for drag interactions
  smooth: {
    type: "spring" as const,
    stiffness: 200,
    damping: 30,
    mass: 1.2,
  },
};

// Easing curves matching iOS (cubic-bezier)
export const easing = {
  // iOS default easing
  ios: [0.4, 0.0, 0.2, 1],
  // Ease out - elements entering
  easeOut: [0.0, 0.0, 0.2, 1],
  // Ease in - elements leaving
  easeIn: [0.4, 0.0, 1, 1],
  // Ease in-out - smooth both ways
  easeInOut: [0.4, 0.0, 0.2, 1],
  // Sharp - quick interactions
  sharp: [0.4, 0.0, 0.6, 1],
};

// Animation variants for common patterns
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: spring.default,
};

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: spring.gentle,
};

export const fadeInDown = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
  transition: spring.gentle,
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: spring.bouncy,
};

export const slideInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
  transition: spring.default,
};

export const slideInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: spring.default,
};

// Stagger children animations (like iOS list views)
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: spring.default,
  },
};

// Tap animations (like iOS buttons)
export const tapScale = {
  scale: 0.97,
  transition: { duration: 0.1 },
};

export const tapFeedback = {
  scale: 0.95,
  transition: { 
    type: "spring",
    stiffness: 500,
    damping: 30,
  },
};

// Hover animations
export const hoverScale = {
  scale: 1.02,
  transition: spring.stiff,
};

export const hoverLift = {
  y: -2,
  transition: spring.default,
};

// Page transition variants
export const pageTransition = {
  initial: { opacity: 0, x: -10 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: {
      ...spring.gentle,
      staggerChildren: 0.1,
    },
  },
  exit: { 
    opacity: 0, 
    x: 10,
    transition: spring.default,
  },
};

// Modal/Dialog animations (like iOS sheets)
export const modalTransition = {
  initial: { opacity: 0, scale: 0.95, y: 20 },
  animate: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: spring.bouncy,
  },
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    y: 20,
    transition: spring.default,
  },
};

// Sheet from bottom (like iOS bottom sheet)
export const sheetTransition = {
  initial: { y: "100%" },
  animate: { 
    y: 0,
    transition: spring.smooth,
  },
  exit: { 
    y: "100%",
    transition: spring.default,
  },
};

// Skeleton loading animation
export const skeletonPulse = {
  animate: {
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// Navigation animations
export const navTransition = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  transition: spring.stiff,
};

// Micro-interactions
export const microBounce = {
  scale: [1, 1.1, 1],
  transition: {
    duration: 0.3,
    times: [0, 0.5, 1],
    ease: easing.easeOut,
  },
};

export const microShake = {
  x: [0, -5, 5, -5, 5, 0],
  transition: {
    duration: 0.4,
    times: [0, 0.2, 0.4, 0.6, 0.8, 1],
  },
};

// Success/Error feedback animations
export const successPulse = {
  scale: [1, 1.05, 1],
  transition: {
    duration: 0.5,
    times: [0, 0.5, 1],
  },
};

export const errorShake = microShake;

// Loading spinner replacement - rotating with spring
export const spinnerRotate = {
  rotate: 360,
  transition: {
    duration: 1,
    repeat: Infinity,
    ease: "linear",
  },
};

// Drag constraints (for swipeable elements)
export const dragConstraints = {
  top: 0,
  bottom: 0,
  left: -100,
  right: 100,
};

// Gesture feedback for swipe
export const swipeConfidenceThreshold = 10000;

export const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};
