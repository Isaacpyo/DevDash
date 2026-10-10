import { buildReport } from "@/lib/analytics/report";
import { type ProfileReport, REPORT_SCHEMA_VERSION } from "@/lib/analytics/types";
import { RateLimitBreaker } from "@/lib/cache/breaker";
import type { CacheStatus, SwrCache } from "@/lib/cache/swr";
import { generateDemoData } from "@/lib/github/demo-fixture";
import { BadCredentialsError, ConfigurationError, RateLimitError } from "@/lib/github/errors";
import type { DataProvider, DataSource, GitHubRawData } from "@/lib/github/types";
import { isDemoLogin } from "@/lib/github/username";

export interface ReportEnvelope {
  report: ProfileReport;
  cache: { status: CacheStatus; storedAt: number };
  /** Set when the data shown is cached because GitHub is rate limiting us. */
  rateLimitedUntil: number | null;
}

export interface RefreshResult extends ReportEnvelope {
  /** False when the data was refreshed too recently to fetch again. */
  refreshed: boolean;
}

export interface ReportServiceDeps {
  provider: DataProvider;
  cache: SwrCache;
  breaker: RateLimitBreaker;
  serverToken: string | null;
  now?: () => Date;
  /** Minimum age before a manual refresh hits GitHub again. */
  refreshCooldownMs?: number;
}

export interface RequestContext {
  /** The signed-in viewer's OAuth token; tried before the shared server token. */
  viewerToken?: string | null;
}

interface Credential {
  id: string;
  token: string;
}

export class ReportService {
  private readonly now: () => Date;
  private readonly refreshCooldownMs: number;

  constructor(private readonly deps: ReportServiceDeps) {
    this.now = deps.now ?? (() => new Date());
    this.refreshCooldownMs = deps.refreshCooldownMs ?? 60_000;
  }

  get providerKind(): DataProvider["kind"] {
    return this.deps.provider.kind;
  }

  cacheKey(login: string): string {
    const source = isDemoLogin(login) ? "demo" : this.deps.provider.kind;
    return `report:v${REPORT_SCHEMA_VERSION}:${source}:${login.toLowerCase()}`;
  }

  async getReport(login: string, context: RequestContext = {}): Promise<ReportEnvelope> {
    const result = await this.deps.cache.get(this.cacheKey(login), this.loader(login, context));
    return this.envelope(result.value, result.status, result.storedAt, context);
  }

  /** Manual refresh, throttled so the button can't be used to burn the rate limit. */
  async refreshReport(login: string, context: RequestContext = {}): Promise<RefreshResult> {
    const key = this.cacheKey(login);
    const current = await this.deps.cache.peek<ProfileReport>(key);
    if (current && this.now().getTime() - current.storedAt < this.refreshCooldownMs) {
      return {
        ...(await this.envelope(current.value, current.status, current.storedAt, context)),
        refreshed: false,
      };
    }
    const result = await this.deps.cache.get(key, this.loader(login, context), { force: true });
    return {
      ...(await this.envelope(result.value, result.status, result.storedAt, context)),
      refreshed: result.status === "miss",
    };
  }

  private loader(login: string, context: RequestContext) {
    return async (): Promise<ProfileReport> => {
      const now = this.now();
      const { raw, source } = await this.fetchRaw(login, context);
      return buildReport(raw, { source, now });
    };
  }

  private async fetchRaw(
    login: string,
    context: RequestContext,
  ): Promise<{ raw: GitHubRawData; source: DataSource }> {
    if (isDemoLogin(login)) return { raw: generateDemoData(this.now()), source: "demo" };

    const { provider } = this.deps;
    if (provider.kind === "mock")
      return { raw: await provider.fetchProfile(login), source: "mock" };

    const credentials = this.credentials(context);
    if (credentials.length === 0) throw new ConfigurationError("No GitHub token configured");

    let lastError: unknown;
    for (const credential of credentials) {
      const openUntil = await this.deps.breaker.openUntil(credential.id);
      if (openUntil) {
        lastError = earliestReset(lastError, new RateLimitError(openUntil));
        continue;
      }
      try {
        return {
          raw: await provider.fetchProfile(login, { token: credential.token }),
          source: "github",
        };
      } catch (error) {
        if (error instanceof RateLimitError) {
          await this.deps.breaker.trip(credential.id, error.resetAt);
          lastError = earliestReset(lastError, error);
          continue;
        }
        // A revoked viewer token shouldn't break the page; fall through to the server token.
        if (error instanceof BadCredentialsError && credential.id !== "server") {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  private credentials({ viewerToken }: RequestContext): Credential[] {
    const list: Credential[] = [];
    if (viewerToken)
      list.push({ id: `user:${RateLimitBreaker.tokenId(viewerToken)}`, token: viewerToken });
    if (this.deps.serverToken) list.push({ id: "server", token: this.deps.serverToken });
    return list;
  }

  private async envelope(
    report: ProfileReport,
    status: CacheStatus,
    storedAt: number,
    context: RequestContext,
  ): Promise<ReportEnvelope> {
    let rateLimitedUntil: number | null = null;
    if (status === "stale" && report.source === "github") {
      const resets = await Promise.all(
        this.credentials(context).map((c) => this.deps.breaker.openUntil(c.id)),
      );
      // Only "rate limited" if every credential we could use is blocked.
      if (resets.length > 0 && resets.every((r) => r !== null)) {
        rateLimitedUntil = Math.min(...(resets as number[]));
      }
    }
    return { report, cache: { status, storedAt }, rateLimitedUntil };
  }
}

function earliestReset(previous: unknown, next: RateLimitError): RateLimitError {
  return previous instanceof RateLimitError && previous.resetAt <= next.resetAt ? previous : next;
}
