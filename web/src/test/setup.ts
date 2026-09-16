import "@testing-library/jest-dom/vitest";

vi.mock("sst", () => {
  const value = (envName: string, fallback: string) => ({
    get value() {
      return process.env[envName] ?? fallback;
    },
  });

  return {
    Resource: {
      TursoDbUrl: value("TURSO_DB_URL", "http://127.0.0.1:0"),
      TursoAuthToken: value("TURSO_AUTH_TOKEN", ""),
      BetterAuthSecret: value("BETTER_AUTH_SECRET", "test-secret"),
      BetterAuthUrl: value("BETTER_AUTH_URL", "http://localhost:3000"),
      GoogleClientId: value("GOOGLE_CLIENT_ID", ""),
      GoogleClientSecret: value("GOOGLE_CLIENT_SECRET", ""),
      GithubClientId: value("GITHUB_CLIENT_ID", ""),
      GithubClientSecret: value("GITHUB_CLIENT_SECRET", ""),
    },
  };
});
