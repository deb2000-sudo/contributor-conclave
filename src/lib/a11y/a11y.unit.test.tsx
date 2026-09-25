/**
 * @vitest-environment jsdom
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Disclosure } from "@/components/shell/disclosure";
import { SiteFooter } from "@/components/shell/site-footer";
import { ContributionCalendar } from "@/components/student/contribution-calendar";
import { MessageLog } from "@/components/chat/message-log";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Pager } from "@/components/admin/pager";
import { SelectField } from "@/components/ui/select-field";
import { StatusNote } from "@/components/ui/status-note";
import { TextareaField } from "@/components/ui/textarea-field";
import { TextField } from "@/components/ui/text-field";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mentorship",
  useSearchParams: () => new URLSearchParams(),
}));

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
}

const roots: Root[] = [];

async function render(node: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(node);
  });
  return container;
}

async function expectNoViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      "color-contrast": { enabled: false },
      "page-has-heading-one": { enabled: false },
      region: { enabled: false },
    },
  });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

afterEach(async () => {
  await act(async () => {
    for (const root of roots) {
      root.unmount();
    }
  });
  roots.length = 0;
  document.body.replaceChildren();
});

describe("accessible components", () => {
  it("names the author profile links and opens them in a new tab", async () => {
    const container = await render(
      <SiteFooter
        author={{
          name: "Ada Lovelace",
          githubUrl: "https://github.com/ada",
          linkedinUrl: "https://linkedin.com/in/ada",
        }}
      />,
    );
    const github = container.querySelector("a[href='https://github.com/ada']");
    const linkedin = container.querySelector("a[href='https://linkedin.com/in/ada']");
    expect(github?.textContent).toContain("GitHub profile");
    expect(github?.getAttribute("target")).toBe("_blank");
    expect(github?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(linkedin?.textContent).toContain("LinkedIn profile");
    expect(container.textContent).toContain("Contributor Conclave");
    expect(container.textContent).toContain("Ada Lovelace");
    await expectNoViolations(container);
  });

  it("names fields, describes errors, and ignores an empty error list", async () => {
    const container = await render(
      <form>
        <TextField id="email" name="email" label="Email" type="email" autoComplete="email" />
        <TextField id="batch" name="batch" label="Batch" errors={[]} />
        <TextField id="name" name="firstName" label="First name" errors={["Enter a first name."]} />
        <SelectField
          id="stack"
          name="techStackId"
          label="Tech stack"
          options={[{ value: "react", label: "React" }]}
          errors={["Choose a tech stack."]}
        />
        <TextareaField
          id="message"
          name="body"
          label="Message"
          maxLength={2000}
          description="2000 characters maximum."
          errors={["Enter a message."]}
        />
      </form>,
    );

    const email = container.querySelector<HTMLInputElement>("#email");
    const batch = container.querySelector<HTMLInputElement>("#batch");
    const name = container.querySelector<HTMLInputElement>("#name");
    const message = container.querySelector<HTMLTextAreaElement>("#message");
    expect(email?.labels?.[0]?.textContent).toBe("Email");
    expect(batch?.getAttribute("aria-invalid")).toBeNull();
    expect(name?.getAttribute("aria-invalid")).toBe("true");
    expect(name?.getAttribute("aria-describedby")).toBe("name-error");
    expect(container.querySelector("#name-error")?.textContent).toContain("Enter a first name.");
    expect(message?.getAttribute("aria-describedby")).toBe("message-description message-error");
    expect(message?.maxLength).toBe(2000);
    await expectNoViolations(container);
  });

  it("exposes tables, pagination, dialogs, and status text", async () => {
    const container = await render(
      <main>
        <h1>Reviews</h1>
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Reviews" }]} />
        <DataTable
          caption="Pull request reviews"
          columns={[{ key: "pull", header: "Pull request" }]}
          rows={[{ id: "1", pull: "Add a test" }]}
          emptyTitle="No reviews yet"
          emptyDescription="Submitted pull requests will appear here."
        />
        <Pager page={1} total={40} pageSize={20} href={(page) => `/reviews?page=${page}`} />
        <Dialog label="What a review includes" title="What a review includes">
          <p>A mentor records a decision and a comment.</p>
        </Dialog>
        <ErrorState title="This page could not be loaded" titleLevel="h1" onRetry={() => undefined} />
        <LoadingState label="Loading the admin workspace" />
        <StatusNote>The message was sent.</StatusNote>
      </main>,
    );

    expect(container.querySelector("table caption")?.textContent).toBe("Pull request reviews");
    expect(container.querySelector("th")?.getAttribute("scope")).toBe("col");
    expect(container.querySelector("[aria-label='Pagination'] button")?.textContent).toBe("Previous");
    expect(container.querySelector("[aria-label='Pagination'] button")).toHaveProperty("disabled", true);
    const opener = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "What a review includes");
    await act(async () => {
      opener?.click();
    });
    const dialog = container.querySelector("dialog");
    expect(dialog?.open).toBe(true);
    expect(dialog?.getAttribute("aria-labelledby")).toBe(container.querySelector("dialog h2")?.id);
    expect(document.activeElement).toBe(container.querySelector("dialog h2"));
    expect(container.querySelector("[role='status']")?.textContent).toContain("Loading the admin workspace");
    expect(container.querySelector("[data-route-status]")?.textContent).toBe("The message was sent.");
    await expectNoViolations(container);
  });

  it("keeps chat messages and contribution counts in the accessibility tree", async () => {
    const container = await render(
      <div>
        <MessageLog
          olderHref="/student/chat/submission?before=1"
          latestHref={null}
          messages={[
            {
              id: "11111111-1111-4111-8111-111111111111",
              text: "Look at the diff.",
              createdAt: new Date("2026-09-25T09:00:00Z"),
              senderName: "Mentor Person",
              own: true,
              status: "SENT",
            },
          ]}
        />
        <ContributionCalendar
          calendar={{
            total: 2,
            days: [
              { date: "2026-09-24", count: 0 },
              { date: "2026-09-25", count: 2 },
            ],
          }}
        />
      </div>,
    );

    const article = container.querySelector("article");
    expect(article?.querySelector("time")?.getAttribute("dateTime")).toBe("2026-09-25T09:00:00.000Z");
    expect(article?.textContent).toContain("Sent");
    expect(container.querySelector("ol")?.getAttribute("aria-label")).toBe("Messages");
    const counts = container.querySelectorAll("table tbody tr");
    expect(counts).toHaveLength(2);
    expect(container.querySelector("table caption")?.textContent).toBe("Daily contributions");
    await expectNoViolations(container);
  });

  it("closes a disclosure from the keyboard and returns focus to its summary", async () => {
    const container = await render(
      <Disclosure summary="Menu" summaryClassName="rounded-md">
        <a href="/mentorship">Mentorship</a>
      </Disclosure>,
    );
    const details = container.querySelector("details");
    const summary = container.querySelector("summary");
    if (!details || !summary) {
      throw new Error("disclosure missing");
    }
    details.open = true;
    summary.focus();
    await act(async () => {
      details.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });
});
