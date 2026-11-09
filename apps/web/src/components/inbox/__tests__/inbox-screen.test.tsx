import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { InboxScreen } from "../inbox-screen";
import type { InboxMessage } from "@/lib/inbox/types";

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));
import { track } from "@/lib/telemetry";

const NOW = Date.parse("2026-08-25T12:00:00.000Z");

const msg = (over: Partial<InboxMessage> = {}): InboxMessage => ({
  id: "m1",
  type: "milestone",
  title: "10 Focus Days",
  body: "Thanks for coming back.",
  ctaLabel: null,
  ctaHref: null,
  readAt: null,
  createdAt: "2026-08-25T09:00:00.000Z",
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("InboxScreen", () => {
  it("splits into New and Earlier, and only shows a section that has messages", () => {
    render(
      <InboxScreen
        messages={[msg(), msg({ id: "m2", readAt: "2026-08-24T00:00:00.000Z" })]}
        nowMs={NOW}
        onBack={vi.fn()}
        onMarkRead={vi.fn()}
      />,
    );

    expect(screen.getByTestId("inbox-section-unread")).toBeInTheDocument();
    expect(screen.getByTestId("inbox-section-read")).toBeInTheDocument();
  });

  it("shows no section headers at all when the inbox is empty", () => {
    render(
      <InboxScreen messages={[]} nowMs={NOW} onBack={vi.fn()} onMarkRead={vi.fn()} />,
    );

    expect(screen.getByTestId("inbox-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("inbox-section-unread")).toBeNull();
    expect(screen.queryByTestId("inbox-section-read")).toBeNull();
  });

  it("keeps the body hidden until the card is tapped", () => {
    render(
      <InboxScreen messages={[msg()]} nowMs={NOW} onBack={vi.fn()} onMarkRead={vi.fn()} />,
    );

    expect(screen.queryByTestId("inbox-card-body")).toBeNull();
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByTestId("inbox-card-body")).toHaveTextContent(
      "Thanks for coming back.",
    );
  });

  it("marks read on open — this is what drops the badge", () => {
    const onMarkRead = vi.fn();
    render(
      <InboxScreen messages={[msg()]} nowMs={NOW} onBack={vi.fn()} onMarkRead={onMarkRead} />,
    );

    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(onMarkRead).toHaveBeenCalledWith("m1");
  });

  it("does NOT mark read again when collapsing or re-expanding", () => {
    // Collapsing is not a second read, and neither is looking twice.
    const onMarkRead = vi.fn();
    render(
      <InboxScreen messages={[msg()]} nowMs={NOW} onBack={vi.fn()} onMarkRead={onMarkRead} />,
    );

    const head = screen.getByRole("button", { expanded: false });
    fireEvent.click(head); // open  → marks
    fireEvent.click(head); // close → nothing
    fireEvent.click(head); // open  → still nothing new to mark

    expect(onMarkRead).toHaveBeenCalledTimes(1);
  });

  it("never marks an already-read message", () => {
    const onMarkRead = vi.fn();
    render(
      <InboxScreen
        messages={[msg({ readAt: "2026-08-24T00:00:00.000Z" })]}
        nowMs={NOW}
        onBack={vi.fn()}
        onMarkRead={onMarkRead}
      />,
    );

    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(onMarkRead).not.toHaveBeenCalled();
  });

  it("⛔ emits NOTHING on render — only on the tap", () => {
    // The `peones_balance_viewed` lesson: an event fired when a component
    // appears records no intention and drowns the ones that do.
    render(
      <InboxScreen messages={[msg()]} nowMs={NOW} onBack={vi.fn()} onMarkRead={vi.fn()} />,
    );
    expect(track).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(track).toHaveBeenCalledWith(
      "inbox_message_opened",
      expect.objectContaining({ message_id: "m1", message_type: "milestone" }),
    );
  });

  it("⛔ never puts the body or a wallet into telemetry", () => {
    render(
      <InboxScreen messages={[msg()]} nowMs={NOW} onBack={vi.fn()} onMarkRead={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { expanded: false }));

    const props = vi.mocked(track).mock.calls[0]?.[1] ?? {};
    const serialized = JSON.stringify(props);
    expect(serialized).not.toContain("Thanks for coming back");
    expect(serialized).not.toMatch(/0x[0-9a-fA-F]{6,}/);
  });

  it("⛔ keeps the body OPEN after the message becomes read", () => {
    /* The bug the DOM smoke found and these tests could not: partitioning live
     * moved the card from "New for you" to "Earlier" the moment it was marked
     * read, React remounted it in the other section, and its `open` state died
     * with the old instance. The body opened and closed in the same tap.
     *
     * The rerender below is what a unit test has to do to simulate the parent's
     * optimistic update — without it, `readAt` never changes and the remount
     * never happens. */
    const first = msg({ id: "keep" });
    const { rerender } = render(
      <InboxScreen messages={[first]} nowMs={NOW} onBack={vi.fn()} onMarkRead={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByTestId("inbox-card-body")).toBeInTheDocument();

    rerender(
      <InboxScreen
        messages={[{ ...first, readAt: "2026-08-25T12:00:01.000Z" }]}
        nowMs={NOW}
        onBack={vi.fn()}
        onMarkRead={vi.fn()}
      />,
    );

    expect(screen.getByTestId("inbox-card-body")).toBeInTheDocument();
    // And it stays where the reader left it, instead of jumping to Earlier.
    expect(screen.getByTestId("inbox-section-unread")).toBeInTheDocument();
  });

  it("renders a CTA only when the message carries one", () => {
    const { rerender } = render(
      <InboxScreen messages={[msg()]} nowMs={NOW} onBack={vi.fn()} onMarkRead={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.queryByRole("link")).toBeNull();

    rerender(
      <InboxScreen
        messages={[msg({ id: "m9", ctaLabel: "See gift", ctaHref: "/x" })]}
        nowMs={NOW}
        onBack={vi.fn()}
        onMarkRead={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByRole("link", { name: "See gift" })).toBeInTheDocument();
  });

  it("flags unread messages and checks off read ones", () => {
    render(
      <InboxScreen
        messages={[msg(), msg({ id: "m2", readAt: "2026-08-24T00:00:00.000Z" })]}
        nowMs={NOW}
        onBack={vi.fn()}
        onMarkRead={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId("inbox-card-new")).toHaveLength(1);
  });
});
