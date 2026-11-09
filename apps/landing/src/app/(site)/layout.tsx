import { LandingDocument } from "@/components/landing/landing-document";
export { metadata, viewport } from "@/components/landing/landing-document";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <LandingDocument>{children}</LandingDocument>;
}
