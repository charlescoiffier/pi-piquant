import { describe, expect, it } from "vitest";
import html from "../index.html?raw";

describe("statistiques de visite (Umami)", () => {
  it("la balise est présente, limitée à pi-piquant.charlescoiffier.fr et respecte Do Not Track", () => {
    const tag = html.match(/<script[^>]*src="https:\/\/stats\.charlescoiffier\.fr\/script\.js"[^>]*>/);
    expect(tag).not.toBeNull();
    expect(tag![0]).toMatch(/\bdefer\b/);
    expect(tag![0]).toContain('data-website-id="a504d608-eb08-4433-bca7-7ebc61724446"');
    expect(tag![0]).toContain('data-domains="pi-piquant.charlescoiffier.fr"');
    expect(tag![0]).toContain('data-do-not-track="true"');
  });
});
