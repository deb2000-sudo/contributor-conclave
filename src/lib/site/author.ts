/**
 * Public footer profile.
 *
 * The repository does not include the author's name or profile URLs.
 * Set these before deployment. They are display values, not credentials.
 *
 * AUTHOR_NAME
 * AUTHOR_GITHUB_URL   https://github.com/USERNAME
 * AUTHOR_LINKEDIN_URL https://www.linkedin.com/in/PROFILE
 *
 * A missing or invalid URL is omitted. The footer does not invent a profile link.
 */

export type AuthorProfile = {
  name: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
};

const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);
const LINKEDIN_HOSTS = new Set(["linkedin.com", "www.linkedin.com"]);

function readName(value: string | undefined): string | null {
  const name = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!name || name.length > 80 || /[\u0000-\u001F<>]/.test(name)) {
    return null;
  }
  return name;
}

function readProfileUrl(value: string | undefined, kind: "github" | "linkedin"): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (kind === "github") {
    if (!GITHUB_HOSTS.has(url.hostname) || parts.length !== 1 || !/^[A-Za-z0-9-]+$/.test(parts[0])) {
      return null;
    }
  } else if (
    !LINKEDIN_HOSTS.has(url.hostname) ||
    parts.length !== 2 ||
    parts[0] !== "in" ||
    !/^[\p{L}\p{N}_-]+$/u.test(parts[1])
  ) {
    return null;
  }

  url.hostname = url.hostname.replace(/^www\./, "");
  return url.toString();
}

export function readAuthorProfile(
  env: {
    AUTHOR_NAME?: string;
    AUTHOR_GITHUB_URL?: string;
    AUTHOR_LINKEDIN_URL?: string;
  } = process.env,
): AuthorProfile {
  return {
    name: readName(env.AUTHOR_NAME),
    githubUrl: readProfileUrl(env.AUTHOR_GITHUB_URL, "github"),
    linkedinUrl: readProfileUrl(env.AUTHOR_LINKEDIN_URL, "linkedin"),
  };
}
