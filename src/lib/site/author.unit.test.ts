import { describe, expect, it } from "vitest";

import { readAuthorProfile } from "@/lib/site/author";

describe("author profile", () => {
  it("reads a name and https profile URLs", () => {
    expect(
      readAuthorProfile({
        AUTHOR_NAME: "  Ada Lovelace  ",
        AUTHOR_GITHUB_URL: "https://github.com/ada",
        AUTHOR_LINKEDIN_URL: "https://www.linkedin.com/in/ada",
      }),
    ).toEqual({
      name: "Ada Lovelace",
      githubUrl: "https://github.com/ada",
      linkedinUrl: "https://linkedin.com/in/ada",
    });
  });

  it("drops an empty name and any URL that is not a profile page", () => {
    expect(
      readAuthorProfile({
        AUTHOR_NAME: " ",
        AUTHOR_GITHUB_URL: "https://github.com/ada/repo",
        AUTHOR_LINKEDIN_URL: "http://linkedin.com/in/ada",
      }),
    ).toEqual({
      name: null,
      githubUrl: null,
      linkedinUrl: null,
    });
  });
});
