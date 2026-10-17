import { expect, test, type Page } from "@playwright/test";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function register(page: Page) {
  const email = `e2e-${unique()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return email;
}

test("signed-out visitors are sent to sign in, and APIs return 401", async ({ page, request }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  const res = await request.get("/api/quizzes");
  expect(res.status()).toBe(401);
});

test("a new user sees empty states, not invented analytics", async ({ page }) => {
  await register(page);
  await expect(page.getByRole("heading", { name: "Welcome to Full-Stack Academy" })).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "No study history yet" })).toBeVisible();
});

test("study flashcards, leave, and resume with progress saved", async ({ page }) => {
  await register(page);
  await page.goto("/flashcards?start=1");
  await page.getByRole("button", { name: /Show answer/ }).click();
  await page.getByRole("button", { name: /^Good/ }).click();
  await expect(page.getByText(/Card 2 of/)).toBeVisible();

  await page.goto("/dashboard");
  await page.goto("/flashcards");
  await expect(page.getByText("You have an unfinished session")).toBeVisible();
  await page.getByRole("button", { name: "Resume session" }).click();
  await expect(page.getByText(/Card 2 of/)).toBeVisible();

  await page.goto("/review");
  await expect(page.getByText(/Recent reviews/)).toBeVisible();
});

test("take a quiz in each selection mode and see stored results", async ({ page }) => {
  await register(page);
  for (const mode of ["New questions", "Review weak topics", "Mixed practice"]) {
    await page.goto("/quizzes/new");
    await page.getByText(mode, { exact: true }).click();
    await page.getByLabel("Questions", { exact: true }).selectOption("5");
    await page.getByRole("button", { name: "Start quiz" }).click();
    await expect(page).toHaveURL(/\/quizzes\/[^/]+$/);
    await expect(page.getByText(/Picked for you/)).toBeVisible();
  }

  // Answer every question in the last quiz with the first option / a short text.
  for (let i = 0; i < 5; i++) {
    const option = page.locator('input[type="radio"], input[type="checkbox"]').first();
    if (await option.count()) await option.check({ force: true });
    else await page.getByLabel("Your answer").fill("409");
    await page.getByRole("button", { name: "Submit answer" }).click();
    const next = page.getByRole("button", { name: "Next question" });
    await next.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    if (await next.isVisible()) await next.click();
  }
  await page.getByRole("button", { name: "See results" }).click();
  await expect(page).toHaveURL(/\/results$/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Retake all" })).toBeVisible();
});

test("interview practice works without an AI key", async ({ page }) => {
  await register(page);
  await page.goto("/interview");
  await page.getByRole("button", { name: "Start interview" }).click();
  await expect(page).toHaveURL(/\/interview\/.+/);
  await page.getByLabel("Your answer").fill("Use an idempotency key stored under a unique constraint, inside a transaction.");
  await page.getByRole("button", { name: /Save and reveal model answer/ }).click();
  await expect(page.getByRole("heading", { name: "Model answer" })).toBeVisible();
  await expect(page.getByText("AI feedback")).toHaveCount(0);
});

test("non-admins cannot reach admin pages or APIs", async ({ page }) => {
  await register(page);
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
  const api = await page.request.get("/api/admin/questions");
  expect(api.status()).toBe(403);
});

test("learn mode: unfamiliar in a quiz recommends the lesson, teach-me opens it, practice and completion clear the recommendation", async ({ page }) => {
  await register(page);

  await page.goto("/quizzes/new");
  await page.getByText("HTTP fundamentals and status codes", { exact: true }).click();
  await page.getByText("New questions", { exact: true }).click();
  await page.getByLabel("Questions", { exact: true }).selectOption("5");
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page).toHaveURL(/\/quizzes\/[^/]+$/);

  await page.getByRole("button", { name: "I haven't learned this yet" }).click();
  // The button's own "Marked" confirmation is transient — it refetches the quiz right after,
  // which replaces the button with the graded-feedback view. Wait for that instead.
  await expect(page.getByText("Compare your answer with the model answer")).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Lessons to study" })).toBeVisible();
  await expect(page.getByText("HTTP fundamentals and status codes: essentials").first()).toBeVisible();
  await page.getByRole("link", { name: "Study", exact: true }).first().click();
  await expect(page).toHaveURL(/\/learn\/.+/);

  await expect(page.getByRole("heading", { name: "HTTP fundamentals and status codes: essentials" })).toBeVisible();
  const option = page.locator('input[type="radio"], input[type="checkbox"]').first();
  if (await option.count()) await option.check({ force: true });
  else await page.getByLabel("Your answer").first().fill("an answer");
  await page.getByRole("button", { name: "Check answer" }).first().click();

  await page.getByRole("button", { name: "Well", exact: true }).click();
  await page.getByRole("button", { name: "Mark as complete" }).click();
  await expect(page.getByText(/^Completed — /)).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByText("HTTP fundamentals and status codes: essentials")).toHaveCount(0);
});
