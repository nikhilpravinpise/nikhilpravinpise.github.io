// GitHub GraphQL queries used by scripts/sync-github-data.js.
// Pure data-fetching helpers - no fs, no process.env.

const API = "https://api.github.com/graphql";

const CALENDAR_QUERY = `
query($login: String!) {
  user(login: $login) {
    createdAt
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
    }
  }
}`;

const REPOS_QUERY = `
query($login: String!) {
  user(login: $login) {
    repositories(
      first: 8
      ownerAffiliations: OWNER
      privacy: PUBLIC
      isFork: false
      orderBy: { field: STARGAZERS, direction: DESC }
    ) {
      nodes {
        name
        description
        url
        stargazerCount
        forkCount
        isArchived
        pushedAt
        primaryLanguage { name color }
      }
    }
  }
}`;

async function graphql(token, query, variables) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30_000), // never hang the CI job on a stalled request
  });
  if (!res.ok) {
    throw new Error(`GitHub GraphQL request failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(`GitHub GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  if (!json.data || !json.data.user) {
    throw new Error("GitHub user data missing or query failed");
  }
  return json.data.user;
}

/** { createdAt, calendar: { totalContributions, days: [{date, count}] } } */
export async function fetchContributionCalendar(token, username) {
  const user = await graphql(token, CALENDAR_QUERY, { login: username });
  const cal = user.contributionsCollection.contributionCalendar;
  return {
    createdAt: user.createdAt,
    totalContributions: cal.totalContributions,
    days: cal.weeks
      .flatMap((w) => w.contributionDays)
      .map((d) => ({ date: d.date, count: d.contributionCount })),
  };
}

/** Top public repos by stars: [{name, description, url, stars, forks, ...}] */
export async function fetchTopRepos(token, username) {
  const user = await graphql(token, REPOS_QUERY, { login: username });
  return user.repositories.nodes.map((r) => ({
    name: r.name,
    description: r.description || "",
    url: r.url,
    stars: r.stargazerCount,
    forks: r.forkCount,
    archived: r.isArchived,
    pushed_at: r.pushedAt,
    language: r.primaryLanguage ? r.primaryLanguage.name : null,
    language_color: r.primaryLanguage ? r.primaryLanguage.color : null,
  }));
}
