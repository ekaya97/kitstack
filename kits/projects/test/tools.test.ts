import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createTestKit } from "@kitstackco/sdk/testing";
import kit from "../kit.config";

describe("projects kit", () => {
  let testKit: Awaited<ReturnType<typeof createTestKit>>;

  beforeAll(async () => {
    testKit = await createTestKit(kit);
  });

  afterEach(async () => {
    await testKit.reset();
  });

  // --- Client tools ---

  it("adds a client", async () => {
    const result = await testKit.call("add_client", { name: "Müller GmbH", industry: "Manufacturing" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Müller GmbH");
  });

  // --- Project tools ---

  it("adds a project with auto-created client", async () => {
    const result = await testKit.call("add_project", {
      name: "Brand Redesign",
      client: "Müller GmbH",
      due_date: "2026-06-15",
      budget: 5000,
      billing_type: "fixed",
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Brand Redesign");
    expect(result.content[0].text).toContain("Müller GmbH");
  });

  it("adds a project and reuses existing client", async () => {
    await testKit.call("add_client", { name: "Müller GmbH" });
    const result = await testKit.call("add_project", {
      name: "Website Relaunch",
      client: "Müller",
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Website Relaunch");
  });

  it("lists projects (empty)", async () => {
    const result = await testKit.call("list_projects", {});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("No projects found");
  });

  it("lists projects with data", async () => {
    await testKit.call("add_project", { name: "Alpha" });
    await testKit.call("add_project", { name: "Beta" });
    const result = await testKit.call("list_projects", {});
    expect(result.content[0].text).toContain("Alpha");
    expect(result.content[0].text).toContain("Beta");
  });

  it("updates project status", async () => {
    await testKit.call("add_project", { name: "Test Project" });
    const result = await testKit.call("update_project", { project: "Test Project", status: "paused" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("updated");
  });

  // --- Milestone tools ---

  it("adds a milestone to a project", async () => {
    await testKit.call("add_project", { name: "Redesign" });
    const result = await testKit.call("add_milestone", {
      project: "Redesign",
      name: "Logo Concepts",
      due_date: "2026-05-20",
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Logo Concepts");
    expect(result.content[0].text).toContain("Redesign");
  });

  it("returns not found for missing project milestone", async () => {
    const result = await testKit.call("add_milestone", {
      project: "Nonexistent",
      name: "Phase 1",
    });
    expect(result.isError).toBe(true);
  });

  // --- Task tools ---

  it("adds a task to a project", async () => {
    await testKit.call("add_project", { name: "Website" });
    const result = await testKit.call("add_task", {
      project: "Website",
      title: "Design homepage",
      priority: "high",
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Design homepage");
  });

  it("updates task status to done", async () => {
    await testKit.call("add_project", { name: "Website" });
    await testKit.call("add_task", { project: "Website", title: "Wireframes" });
    const result = await testKit.call("update_task", { task: "Wireframes", status: "done" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("updated");
  });

  it("lists tasks across projects", async () => {
    await testKit.call("add_project", { name: "A" });
    await testKit.call("add_project", { name: "B" });
    await testKit.call("add_task", { project: "A", title: "Task A1" });
    await testKit.call("add_task", { project: "B", title: "Task B1" });
    const result = await testKit.call("list_tasks", {});
    expect(result.content[0].text).toContain("Task A1");
    expect(result.content[0].text).toContain("Task B1");
  });

  // --- Time logging ---

  it("logs time on a project", async () => {
    await testKit.call("add_project", { name: "Müller Redesign" });
    const result = await testKit.call("log_time", {
      project: "Müller",
      duration_minutes: 120,
      description: "Logo exploration",
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("2.0h");
    expect(result.content[0].text).toContain("Müller Redesign");
  });

  // --- Read / aggregate tools ---

  it("shows project overview", async () => {
    await testKit.call("add_project", { name: "Big Project", budget: 10000, billing_type: "hourly", hourly_rate: 100 });
    await testKit.call("add_task", { project: "Big Project", title: "Step 1" });
    await testKit.call("log_time", { project: "Big Project", duration_minutes: 60 });
    const result = await testKit.call("project_overview", { project: "Big Project" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Big Project");
    expect(result.content[0].text).toContain("Step 1");
  });

  it("shows dashboard", async () => {
    await testKit.call("add_project", { name: "Active One" });
    const result = await testKit.call("dashboard", {});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Dashboard");
  });

  it("shows time report", async () => {
    await testKit.call("add_project", { name: "Time Test" });
    await testKit.call("log_time", { project: "Time Test", duration_minutes: 90, date: new Date().toISOString().split("T")[0] });
    const result = await testKit.call("time_report", { period: "this_month" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Time Test");
  });

  it("shows budget status", async () => {
    await testKit.call("add_project", {
      name: "Budget Test",
      budget: 5000,
      billing_type: "hourly",
      hourly_rate: 100,
    });
    await testKit.call("log_time", { project: "Budget Test", duration_minutes: 2400 });
    const result = await testKit.call("budget_status", { project: "Budget Test" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Budget Status");
    expect(result.content[0].text).toContain("€5000");
  });

  // --- Archive ---

  it("archives a project", async () => {
    await testKit.call("add_project", { name: "Old Project" });
    const result = await testKit.call("archive", { entity_type: "project", name_or_id: "Old Project" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("archived");

    // Should not appear in list
    const list = await testKit.call("list_projects", {});
    expect(list.content[0].text).toContain("No projects found");
  });
});
