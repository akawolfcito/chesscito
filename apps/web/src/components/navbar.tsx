"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ConnectButton } from "@/components/connect-button"

const navLinks = [
  { name: "Home", href: "/" },
  { name: "Levels", href: "/levels" },
  { name: "Leaderboard", href: "/leaderboard" },
  { name: "Docs", href: "https://docs.celo.org", external: true },
]

export function Navbar() {
  const pathname = usePathname()
  
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-screen-lg items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {/* Mobile menu button */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <div className="mb-8 flex items-center gap-2">
                <span className="font-bold text-lg">
                  chesscito
                </span>
              </div>
              <nav className="flex flex-col gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className={`flex items-center gap-2 text-base font-medium transition-colors hover:text-primary ${
                      pathname === link.href ? "text-foreground" : "text-foreground/70"
                    }`}
                  >
                    {link.name}
                    {link.external && <ExternalLink className="h-4 w-4" />}
                  </Link>
                ))}
                <div className="mt-6 border-t pt-6">
                  <ConnectButton />
                </div>
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <span className="hidden font-bold text-xl sm:inline-block">
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
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary ${
                pathname === link.href
                  ? "text-foreground"
                  : "text-foreground/70"
              }`}
            >
              {link.name}
              {link.external && <ExternalLink className="h-4 w-4" />}
            </Link>
          ))}
          
          <div className="flex items-center gap-3">
            <ConnectButton />
          </div>
        </nav>
      </div>
    </header>
  )
}
