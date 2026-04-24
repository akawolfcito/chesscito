import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'rounded-md bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:
          'rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'rounded-md hover:bg-accent hover:text-accent-foreground',
        link: 'rounded-md text-primary underline-offset-4 hover:underline',
        // Warm candy-solid brown with cream text — the single "primary
        // action" color across every candy-light modal (PLAY, Enter
        // Arena, Submit Score, Play Again, Accept Challenge…).
        'game-primary':
          'rounded-2xl bg-[rgb(120,65,5)] font-bold text-[rgb(255,240,180)] shadow-[0_4px_12px_rgba(120,65,5,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110 active:scale-[0.97]',
        // Shorter warm-solid used for tighter chips/CTA rows.
        'game-solid':
          'rounded-xl bg-[rgb(120,65,5)] font-semibold text-[rgb(255,240,180)] shadow-[0_3px_8px_rgba(120,65,5,0.28),inset_0_1px_0_rgba(255,255,255,0.22)] hover:brightness-110 active:scale-[0.97]',
        // Translucent white glass with warm-brown text — secondary
        // actions that sit below the primary (Play Again when there is
        // also a Claim, Back to Hub ghost, etc.).
        'game-ghost':
          'rounded-2xl border border-[rgba(255,255,255,0.45)] bg-white/15 font-semibold text-[rgba(110,65,15,0.90)] [text-shadow:0_1px_0_rgba(255,245,215,0.55)] backdrop-blur-[6px] hover:bg-white/25 active:scale-[0.97]',
        // Warm-brown subtle link-style text for tertiary actions.
        'game-text':
          'rounded-xl font-medium text-[rgba(110,65,15,0.70)] hover:text-[rgba(110,65,15,0.95)] active:scale-[0.97]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
        game: 'w-full py-3',
        'game-sm': 'w-full py-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
