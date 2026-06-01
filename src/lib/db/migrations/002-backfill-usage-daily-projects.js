// Rebuild usageDaily from usageHistory so legacy daily rows gain byProject /
// byApiKeyProject maps. Daily rows written before the per-project feature
// shipped carry day.cost / byModel / byApiKey but omit the project maps, so the
// 7d/30d/60d/all stats undercounted Usage-by-Project vs the Est. Cost card.
//
// usageHistory is the complete authoritative record (no pruning anywhere), and
// sum(usageHistory.cost) per day == day.cost, so re-aggregating is lossless.
import { getLocalDateKey, aggregateEntryToDay } from "../helpers/aggregate.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

export default {
  version: 2,
  name: "backfill-usage-daily-projects",
  up(db) {
    // Versioned migrations run BEFORE the additive schema sync that adds missing
    // columns, so on an upgrade from a build predating the `project` column the
    // column may not exist yet. Select NULL for it in that case — those rows are
    // genuinely untagged (the feature didn't exist when they were written).
    const columns = new Set(db.all(`PRAGMA table_info(usageHistory)`).map((column) => column.name));
    const projectSelect = columns.has("project") ? "project" : "NULL AS project";

    const rows = db.all(
      `SELECT timestamp, provider, model, connectionId, apiKey, endpoint, ${projectSelect}, cost, tokens FROM usageHistory`
    );
    if (!rows.length) return; // no history → leave existing daily rows untouched

    const byDay = {};
    for (const row of rows) {
      const dateKey = getLocalDateKey(row.timestamp);
      byDay[dateKey] ||= {
        requests: 0, promptTokens: 0, completionTokens: 0, cost: 0,
        byProvider: {}, byModel: {}, byAccount: {}, byApiKey: {},
        byEndpoint: {}, byProject: {}, byApiKeyProject: {},
      };
      aggregateEntryToDay(byDay[dateKey], {
        provider: row.provider, model: row.model, connectionId: row.connectionId,
        apiKey: row.apiKey, endpoint: row.endpoint, project: row.project,
        cost: row.cost,                    // stored column — never recompute via pricing
        tokens: parseJson(row.tokens, {}), // nested shape aggregateEntryToDay expects
      });
    }

    // Only days that have history rows are rebuilt; daily-only dates (e.g. an
    // imported summary with no underlying history) are left untouched.
    for (const [dateKey, day] of Object.entries(byDay)) {
      db.run(
        `INSERT INTO usageDaily(dateKey, data) VALUES(?, ?) ON CONFLICT(dateKey) DO UPDATE SET data = excluded.data`,
        [dateKey, stringifyJson(day)]
      );
    }
  },
};
