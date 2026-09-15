import type { PrepareDebriefInput } from "../src/contracts";

export class FakeClock {
  constructor(private current: Date) {}
  now = (): Date => new Date(this.current);
  iso = (): string => this.now().toISOString();
  set(value: string | Date): void { this.current = new Date(value); }
  advance(ms: number): void { this.current = new Date(this.current.getTime() + ms); }
}

export class DeterministicScheduler {
  private readonly jobs: Array<{ at: number; run: () => void | Promise<void> }> = [];
  constructor(private readonly clock: FakeClock) {}
  schedule(at: string, run: () => void | Promise<void>): void { this.jobs.push({ at: Date.parse(at), run }); }
  async runDue(): Promise<void> {
    const due = this.jobs.filter((job) => job.at <= this.clock.now().getTime());
    for (const job of due) {
      this.jobs.splice(this.jobs.indexOf(job), 1);
      await job.run();
    }
  }
  get pending(): number { return this.jobs.length; }
}

export const presenterRequest = (callbackAt: string): PrepareDebriefInput => ({
  goal: "Qualify the next opportunity",
  company: "Acme Corp",
  contact_name: "Mr John Doe",
  location: "Köln Café",
  callback_at: callbackAt,
  callback_timezone: "Europe/Berlin",
  buffer_minutes: 5,
});
