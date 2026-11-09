import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArtImage } from "@/components/onboarding/art-image";

/**
 * The prop split is the whole point of this component's API, and it is the
 * kind of mistake that fails silently: `object-position` styles the REPLACED
 * element, so a class routed to the <picture> wrapper does nothing at all and
 * the page still renders. These tests pin which element each prop reaches.
 */
describe("ArtImage", () => {
  it("routes className to the picture and imgClassName to the img", () => {
    const { container } = render(
      <ArtImage
        src="/art/x"
        alt=""
        className="absolute inset-0"
        imgClassName="object-bottom"
      />,
    );

    const picture = container.querySelector("picture");
    const img = container.querySelector("img");

    expect(picture?.className).toContain("absolute inset-0");
    expect(picture?.className).not.toContain("object-bottom");
    expect(img?.className).toContain("object-bottom");
    expect(img?.className).not.toContain("absolute inset-0");
  });

  it("emits the avif/webp/png triplet from one extensionless src", () => {
    const { container } = render(<ArtImage src="/art/slide-bg-1" alt="" />);

    const types = [...container.querySelectorAll("source")].map((s) => [
      s.getAttribute("type"),
      s.getAttribute("srcset"),
    ]);
    expect(types).toEqual([
      ["image/avif", "/art/slide-bg-1.avif"],
      ["image/webp", "/art/slide-bg-1.webp"],
    ]);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/art/slide-bg-1.png",
    );
  });

  it("passes intrinsic dimensions through so the box is reserved before load", () => {
    const { container } = render(
      <ArtImage src="/art/x" alt="" width={941} height={1672} />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("width")).toBe("941");
    expect(img?.getAttribute("height")).toBe("1672");
  });
});
