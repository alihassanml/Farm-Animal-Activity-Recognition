import { motion, type Variants } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * Calm scroll reveal: fade in and rise 20px over 0.6s as an element enters the viewport.
 * The page wraps these in <MotionConfig reducedMotion="user">, so with reduced motion
 * the movement is dropped and only the opacity change remains.
 */
const EASE = [0.22, 1, 0.36, 1] as const
const VIEWPORT = { once: true, margin: '0px 0px -12% 0px' }

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
}

const delayed = (delay: number): Variants => ({
  hidden: item.hidden,
  shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE, delay } },
})

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={VIEWPORT}
      variants={delay ? delayed(delay) : item}
    >
      {children}
    </motion.div>
  )
}

/** Parent that reveals its <StaggerItem> children one after another (80ms apart). */
export function Stagger({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'ol' | 'ul' }) {
  const Tag = as === 'ol' ? motion.ol : as === 'ul' ? motion.ul : motion.div
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={VIEWPORT}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.08 } } }}
    >
      {children}
    </Tag>
  )
}

export function StaggerItem({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' }) {
  const Tag = as === 'li' ? motion.li : motion.div
  return (
    <Tag className={className} variants={item}>
      {children}
    </Tag>
  )
}
