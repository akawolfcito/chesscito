import { Fredoka, Lilita_One, Rowdies } from "next/font/google";

// Shared by the locale layout and isolated /dev fixtures so each Google font
// has one initializer and identical settings across the app.
export const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-fredoka",
  display: "swap",
});

export const rowdies = Rowdies({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-rowdies",
  display: "swap",
});

export const lilitaOne = Lilita_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-lilita",
  display: "swap",
});
