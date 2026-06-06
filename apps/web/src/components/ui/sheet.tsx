import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"

import { CandyIcon } from "@/components/redesign/candy-icon"
import { useDesktopAppFrameContainer } from "@/components/chrome/desktop-app-frame"
import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

/**
 * Portal target swap: when a sheet is opened inside the desktop phone-
 * bezel chrome, portal into `.desktop-app-frame-inner` so the sheet
 * (overlay + content) stays bounded by the bezel instead of stretching
 * across the full desktop viewport. On non-framed surfaces (landing,
 * `/share/*`, `/dev/*`), the context returns `null` and Radix falls
 * back to its default `document.body` portal. Mobile is unaffected:
 * the frame ancestor exists in the DOM but the `transform` rule that
 * scopes `position: fixed` only applies at ≥768px.
 */
const SheetPortal = ({
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) => {
  const container = useDesktopAppFrameContainer()
  return (
    <SheetPrimitive.Portal container={container ?? undefined} {...props}>
      {children}
    </SheetPrimitive.Portal>
  )
}

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** When true, suppress the built-in absolute-positioned close button.
   *  Use this when the sheet renders `<ContextualHeader variant="close-control">`
   *  inside its body — the header owns the inline close affordance and the
   *  legacy floating X would render twice. Default `false` keeps every
   *  legacy sheet unchanged. Header-consistency canary 2026-05-20. */
  hideClose?: boolean;
  /** Accessible sheet title. Required by Radix Dialog (`DialogContent
   *  requires a DialogTitle for screen readers`). When the visible header
   *  is rendered by <ContextualHeader>, pass the same string here so we
   *  auto-inject a sr-only <SheetTitle>. Legacy sheets that already
   *  render their own <SheetTitle> child should omit this prop. */
  title?: string;
  /** Optional accessible description. Auto-injects a sr-only
   *  <SheetDescription>. When omitted, `aria-describedby={undefined}`
   *  is set on the dialog content per Radix escape hatch so the missing
   *  Description warning is suppressed without polluting the DOM. */
  description?: string;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, hideClose = false, title, description, onOpenAutoFocus, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      onOpenAutoFocus={(event) => {
        /* Synchronously move focus into the Content element before
         * Radix cascades aria-hidden onto sibling subtrees of the
         * portal target. Without this, the trigger button outside
         * the portal retains focus and Chrome emits
         *   "Blocked aria-hidden on an element because its descendant
         *    retained focus"
         * against `app/[locale]/template.tsx` (the wrapper Radix
         * marks as aria-hidden during the open transition).
         *
         * Radix Dialog Content sets `tabIndex={-1}` so the
         * programmatic focus is valid. `preventScroll` avoids the
         * page jumping when the focus lands. Callers can still pass
         * their own `onOpenAutoFocus` to opt-out — we forward it via
         * the props spread (the override below runs FIRST; if the
         * caller's handler also `preventDefault`s, our focus call
         * still wins because we already moved focus). */
        event.preventDefault();
        (event.currentTarget as HTMLElement | null)?.focus({
          preventScroll: true,
        });
        onOpenAutoFocus?.(event);
      }}
      {...props}
    >
      {/* Auto-injected sr-only title + description so Radix's
        * "DialogContent requires DialogTitle / DialogDescription"
        * warnings never fire for sheets that delegate the visible
        * header to <ContextualHeader>. Only triggers when `title` is
        * provided so legacy sheets that still render their own
        * <SheetTitle>/<SheetDescription> children stay unchanged.
        *
        * `asChild` flips the underlying tag from <h2> / <p> to <span>
        * so the injected element doesn't surface as a duplicate
        * heading in screen-reader trees nor in
        * `getByRole("heading")` test queries — the visible header in
        * <ContextualHeader> remains the canonical heading. Radix
        * still wires aria-labelledby / aria-describedby on the
        * dialog content via the slotted span. */}
      {title ? (
        <>
          <SheetPrimitive.Title asChild>
            <span className="sr-only">{title}</span>
          </SheetPrimitive.Title>
          <SheetPrimitive.Description asChild>
            <span className="sr-only">{description ?? title}</span>
          </SheetPrimitive.Description>
        </>
      ) : null}
      {children}
      {hideClose ? null : (
        <SheetPrimitive.Close
          className="candy-close-button absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-10 disabled:pointer-events-none disabled:opacity-60"
        >
          <CandyIcon name="close" className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      )}
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
