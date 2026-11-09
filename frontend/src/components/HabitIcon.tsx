import {
  Sunrise, Dumbbell, Egg, Beef, Droplet, Code, Wallet, Sparkles, Shirt, Moon, Check, BookOpen,
  Brain, Footprints, Apple, Heart, Leaf, Coffee, type LucideIcon,
} from 'lucide-react';

export const HABIT_ICONS: Record<string, LucideIcon> = {
  sunrise: Sunrise, dumbbell: Dumbbell, egg: Egg, beef: Beef, droplet: Droplet, code: Code, wallet: Wallet,
  sparkles: Sparkles, shirt: Shirt, moon: Moon, check: Check, book: BookOpen, brain: Brain, walk: Footprints,
  apple: Apple, heart: Heart, leaf: Leaf, coffee: Coffee,
};

export function HabitIcon({ name, className }: { name: string; className?: string }) {
  const I = HABIT_ICONS[name] ?? Check;
  return <I className={className} aria-hidden />;
}
