'use client';

import {
  MotionConfig,
  animate,
  motion,
  stagger,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

/**
 * Every animation in the app, in one file.
 *
 * The rule that matters: the `prefers-reduced-motion` sweep in globals.css is
 * CSS-only and cannot touch anything JS-driven. So every component here calls
 * motion's own useReducedMotion() and degrades to an instant, final-state
 * render -- not to a shorter animation, and never to a missing element. A new
 * animated component that skips that hook silently opts the app out of an
 * accessibility behaviour the rest of it honours.
 *
 * The house style is restraint: short durations, small distances, one easing
 * curve. Motion here is for orientation -- showing what arrived, what changed,
 * and what is now selected -- not for decoration.
 *
 * Everything animates on mount rather than on scroll. A scroll-triggered
 * reveal leaves content at opacity zero until an intersection fires, so a
 * missed trigger, a print, or a full-page capture loses it outright. Nothing
 * here gates content on having been seen.
 */

/** Roughly ease-out-expo. Fast to start, long settle. */
export const EASE = [0.16, 1, 0.3, 1] as const;
export const DURATION = 0.45;

/** Wraps the app so every child motion component inherits the same curve. */
export function MotionProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <MotionConfig reducedMotion={reduce ? 'always' : 'never'} transition={{ duration: DURATION, ease: EASE }}>
      {children}
    </MotionConfig>
  );
}

/** Fade and rise on mount. The default entrance for a block of content. */
export function Reveal({
  children,
  delay = 0,
  y = 12,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A list whose children arrive one after another. Use with <StaggerItem>.
 * The delay per child is small on purpose -- a long stagger on a list of ten
 * reads as the page being slow, not as the page being considered.
 */
export function Stagger({
  children,
  className,
  delay = 0,
  each = 0.045,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  each?: number;
  as?: 'div' | 'ul' | 'ol';
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as];

  if (reduce) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Tag
      className={className}
      initial="hidden"
      animate="shown"
      variants={{
        hidden: {},
        shown: { transition: { delayChildren: stagger(each, { startDelay: delay }) } },
      }}
    >
      {children}
    </Tag>
  );
}

export function StaggerItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li';
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as];

  if (reduce) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Tag
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        shown: { opacity: 1, y: 0, transition: { duration: DURATION, ease: EASE } },
      }}
    >
      {children}
    </Tag>
  );
}

/**
 * A number that counts up to its value, and re-counts when it changes.
 *
 * Rendered through a MotionValue rather than React state, so the ~60 frames of
 * a count do not become 60 re-renders of whatever is around it. `format` turns
 * the running number into the string on screen, so this works for currency,
 * points, and plain counts alike.
 */
export function CountUp({
  value,
  format,
  className,
  duration = 0.9,
}: {
  value: number;
  format: (value: number) => string;
  className?: string;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const raw = useMotionValue(0);
  const text = useTransform(raw, (v) => format(v));

  useEffect(() => {
    if (reduce) {
      raw.set(value);
      return;
    }
    const controls = animate(raw, value, { duration, ease: EASE });
    return () => controls.stop();
  }, [value, duration, reduce, raw]);

  // The static value is also the server-rendered one, so there is no flash of
  // zero before hydration.
  if (reduce) return <span className={className}>{format(value)}</span>;
  return <motion.span className={className}>{text}</motion.span>;
}

/**
 * A bar that grows to its ratio. Separate from CountUp because a bar wants a
 * spring -- the slight overshoot is what makes a value feel like it landed.
 */
export function AnimatedBar({
  ratio,
  className,
}: {
  ratio: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;

  if (reduce) return <div className={className} style={{ width }} />;
  return (
    <motion.div
      className={className}
      initial={{ width: 0 }}
      animate={{ width }}
      transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 0.6 }}
    />
  );
}

/**
 * The sliding indicator behind the active nav item. `layoutId` is what makes
 * it travel between items instead of cross-fading -- the single clearest use
 * of motion in the app, because it shows where you came from.
 */
export function NavIndicator({ id }: { id: string }) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <span className="absolute inset-0 -z-10 rounded-lg bg-accent/12" />;
  }
  return (
    <motion.span
      layoutId={id}
      className="absolute inset-0 -z-10 rounded-lg bg-accent/12 ring-1 ring-accent/25"
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
    />
  );
}

/** A quiet pulse for something that wants attention without shouting. */
export function Pulse({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <span className={className} />;
  return (
    <motion.span
      className={className}
      animate={{ opacity: [1, 0.35, 1] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

export { motion, useReducedMotion };
