import type { Metadata } from "next";
import { WHY_PAGE_COPY } from "@/lib/content/editorial";

export const metadata: Metadata = {
  title: WHY_PAGE_COPY.meta.title,
  description: WHY_PAGE_COPY.meta.description,
};

export default function WhyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
