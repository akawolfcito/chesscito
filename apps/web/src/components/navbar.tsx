"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Menu, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConnectButton } from "@/components/connect-button"
import { cn } from "@/lib/utils"

const navLinks = [
  { name: "Home", href: "/" },
  { name: "Play Hub", href: "/play-hub" },
  { name: "Leaderboard", href: "/leaderboard" },
]

export function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const previousMobileOpenRef = useRef(false)
  const isPlayHub = pathname.startsWith("/play-hub")
  const isActiveLink = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (mobileOpen) {
      const firstLink = mobileMenuRef.current?.querySelector<HTMLAnchorElement>("a")
      firstLink?.focus()
    } else if (previousMobileOpenRef.current) {
      menuButtonRef.current?.focus()
    }

    previousMobileOpenRef.current = mobileOpen
  }, [mobileOpen])

  useEffect(() => {
    if (!mobileOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false)
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      const clickedMenu = mobileMenuRef.current?.contains(target)
      const clickedTrigger = menuButtonRef.current?.contains(target)
      if (!clickedMenu && !clickedTrigger) {
        setMobileOpen(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("pointerdown", handlePointerDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [mobileOpen])

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full backdrop-blur-md",
        isPlayHub
          ? "bg-transparent"
          : "border-b bg-background/80 supports-[backdrop-filter]:bg-background/60"
      )}
    >
      <div
        className={cn(
          "relative mx-auto w-full",
          isPlayHub ? "max-w-screen-sm px-3 py-2" : "max-w-screen-lg px-4"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between",
            isPlayHub
              ? "h-12 rounded-2xl border border-cyan-900/45 bg-slate-950/78 px-2 shadow-[0_16px_42px_rgba(2,12,22,0.38)]"
              : "h-16"
          )}
        >
        <div className="flex items-center gap-2">
          {/* Mobile menu button */}
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="icon"
            className={cn(
              "md:hidden",
              isPlayHub ? "text-cyan-100 hover:bg-cyan-900/35 hover:text-cyan-50" : ""
            )}
            onClick={() => setMobileOpen((previous) => !previous)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-menu"
            aria-label={mobileOpen ? "Cerrar menu principal" : "Abrir menu principal"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="sr-only">Toggle menu</span>
          </Button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <span className={cn("font-bold text-base sm:text-xl", isPlayHub ? "text-cyan-50" : "")}>
              chesscito
            </span>
          </Link>
        </div>
        
        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium transition-colors",
                isPlayHub ? "hover:text-cyan-200" : "hover:text-primary",
                isActiveLink(link.href)
                  ? isPlayHub
                    ? "text-cyan-50"
                    : "text-foreground"
                  : isPlayHub
                    ? "text-cyan-100/75"
                    : "text-foreground/70"
              )}
            >
              {link.name}
            </Link>
          ))}
          
          <div className="flex items-center gap-3">
            <ConnectButton />
          </div>
        </nav>
        </div>

        {mobileOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-slate-950/20 md:hidden"
              aria-label="Cerrar menu movil"
              onClick={() => setMobileOpen(false)}
            />
            <div
              ref={mobileMenuRef}
              id="mobile-nav-menu"
              role="dialog"
              aria-modal="true"
              className={cn(
                "md:hidden absolute left-3 right-3 top-[calc(100%+0.35rem)] z-50 rounded-2xl border p-3 shadow-2xl",
                isPlayHub
                  ? "border-cyan-800/45 bg-slate-950/95 text-cyan-50"
                  : "border-slate-200 bg-white/95 text-slate-900"
              )}
            >
              <nav className="flex flex-col gap-1" aria-label="Navegacion principal movil">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                    isActiveLink(link.href)
                      ? isPlayHub
                        ? "bg-cyan-900/45 text-cyan-50"
                        : "bg-slate-100 text-slate-900"
                      : isPlayHub
                        ? "text-cyan-100/85 hover:bg-cyan-900/30"
                        : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  {link.name}
                </Link>
              ))}
              <div className={cn("mt-2 border-t pt-2", isPlayHub ? "border-cyan-900/50" : "border-slate-200")}>
                <ConnectButton />
              </div>
              </nav>
            </div>
          </>
        ) : null}
      </div>
    </header>
  )
}
