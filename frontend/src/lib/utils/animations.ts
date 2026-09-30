import type { Variants } from 'framer-motion';

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 }
};

export const softFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 }
};

export const cardHover = {
  whileHover: { y: -4, boxShadow: '0 12px 24px rgba(15, 23, 42, 0.12)' },
  transition: { duration: 0.2 }
};

export const springIn = {
  type: 'spring',
  stiffness: 300,
  damping: 24
};
