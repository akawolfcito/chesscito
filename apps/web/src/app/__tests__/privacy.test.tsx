import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacyPage from "../privacy/page";

describe("Privacy page — Coach session memory section", () => {
  it("renders the PRIVACY_COACH_COPY heading", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/Coach Match History \(Chesscito PRO\)/i)).toBeInTheDocument();
  });

  it("renders the para1 retention disclosure", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/365 days from creation/i)).toBeInTheDocument();
  });

  it("renders the 'Your control' subheading + body", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/Your control:/i)).toBeInTheDocument();
    expect(screen.getByText(/Deletion is permanent and immediate/i)).toBeInTheDocument();
  });

  it("renders the 'What's stored' subheading + body — game metadata, not move list", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/What's stored:/i)).toBeInTheDocument();
    expect(screen.getByText(/We do NOT store your full move list/i)).toBeInTheDocument();
  });

  it("renders the 'Lost wallet access' subheading + body — out-of-band recourse", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/Lost wallet access:/i)).toBeInTheDocument();
    expect(screen.getByText(/support@chesscito\.app/i)).toBeInTheDocument();
  });
});
