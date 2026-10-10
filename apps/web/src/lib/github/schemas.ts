import { z } from "zod";

/** Validates the parts of GitHub's responses DevDash depends on. Unknown fields are stripped. */

const count = z.object({ totalCount: z.number().int().nonnegative() });

const contributionLevel = z.enum([
  "NONE",
  "FIRST_QUARTILE",
  "SECOND_QUARTILE",
  "THIRD_QUARTILE",
  "FOURTH_QUARTILE",
]);

export const LEVELS: Record<z.infer<typeof contributionLevel>, 0 | 1 | 2 | 3 | 4> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

const language = z.object({ name: z.string(), color: z.string().nullable() });

export const profileQuerySchema = z.object({
  user: z
    .object({
      login: z.string(),
      name: z.string().nullable(),
      avatarUrl: z.string(),
      bio: z.string().nullable(),
      company: z.string().nullable(),
      location: z.string().nullable(),
      websiteUrl: z.string().nullable(),
      twitterUsername: z.string().nullable(),
      url: z.string(),
      createdAt: z.string(),
      followers: count,
      following: count,
      publicRepos: count,
      contributionsCollection: z.object({
        totalCommitContributions: z.number(),
        totalIssueContributions: z.number(),
        totalPullRequestContributions: z.number(),
        totalPullRequestReviewContributions: z.number(),
        restrictedContributionsCount: z.number(),
        contributionCalendar: z.object({
          totalContributions: z.number(),
          weeks: z.array(
            z.object({
              contributionDays: z.array(
                z.object({
                  date: z.string(),
                  contributionCount: z.number(),
                  contributionLevel,
                }),
              ),
            }),
          ),
        }),
      }),
      repositories: z.object({
        nodes: z.array(
          z
            .object({
              name: z.string(),
              nameWithOwner: z.string(),
              url: z.string(),
              description: z.string().nullable(),
              stargazerCount: z.number(),
              forkCount: z.number(),
              isArchived: z.boolean(),
              pushedAt: z.string().nullable(),
              primaryLanguage: language.nullable(),
              languages: z.object({
                edges: z.array(z.object({ size: z.number(), node: language })),
              }),
            })
            .nullable(),
        ),
      }),
    })
    .nullable(),
});

const monthTotals = z.object({
  totalCommitContributions: z.number(),
  totalIssueContributions: z.number(),
  totalPullRequestContributions: z.number(),
  totalPullRequestReviewContributions: z.number(),
});

export function activityQuerySchema(monthCount: number) {
  const months = Object.fromEntries(
    Array.from({ length: monthCount }, (_, i) => [`m${i}`, monthTotals]),
  ) as Record<`m${number}`, typeof monthTotals>;

  return z.object({
    user: z
      .object({
        ...months,
        mergedPullRequests: z.object({
          totalCount: z.number(),
          nodes: z.array(
            z
              .object({
                createdAt: z.string(),
                mergedAt: z.string().nullable(),
                additions: z.number(),
                deletions: z.number(),
              })
              .nullable(),
          ),
        }),
        openPullRequests: count,
        closedPullRequests: count,
      })
      .nullable(),
  });
}

export const restUserSchema = z.object({
  login: z.string(),
  type: z.string(),
});

const optionalString = z
  .string()
  .nullish()
  .transform((v) => v ?? undefined)
  .optional();

export const restEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  repo: z.object({ name: z.string() }),
  created_at: z.string(),
  payload: z
    .object({
      action: optionalString,
      ref: z.string().nullish(),
      ref_type: optionalString,
      size: z.number().optional(),
      commits: z.array(z.unknown()).optional(),
      number: z.number().optional(),
      pull_request: z
        .object({
          number: z.number().optional(),
          title: optionalString,
          merged: z
            .boolean()
            .nullish()
            .transform((v) => v ?? undefined)
            .optional(),
          html_url: optionalString,
        })
        .optional(),
      issue: z
        .object({ number: z.number().optional(), title: optionalString, html_url: optionalString })
        .optional(),
      release: z
        .object({ name: z.string().nullish(), tag_name: optionalString, html_url: optionalString })
        .optional(),
      review: z.object({ state: optionalString, html_url: optionalString }).optional(),
      forkee: z.object({ full_name: optionalString, html_url: optionalString }).optional(),
    })
    .catch({}),
});

/** One malformed event shouldn't hide the rest, so items are validated individually. */
export const restEventsSchema = z
  .array(z.unknown())
  .transform((items) =>
    items.flatMap((item) => {
      const parsed = restEventSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    }),
  );

export const restRateLimitSchema = z.object({
  resources: z.object({
    core: z.object({ limit: z.number(), remaining: z.number(), reset: z.number() }),
    graphql: z.object({ limit: z.number(), remaining: z.number(), reset: z.number() }).optional(),
  }),
});
