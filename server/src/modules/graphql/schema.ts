import { GraphQLError } from 'graphql';
import { createSchema } from 'graphql-yoga';
import { eventHistory } from '../events/event-history.ts';
import type { HmisEvent } from '../events/event.schema.ts';

const MAX_PAGE_SIZE = 50;

// Pagination follows the Relay connection spec (edges, node, cursor, pageInfo), so Relay,
// Apollo and urql clients can page through it without custom code.
const typeDefs = /* GraphQL */ `
  enum Severity {
    INFO
    WARNING
    CRITICAL
  }

  type EventDetail {
    label: String!
    value: String!
  }

  type Event {
    id: ID!
    type: String!
    severity: Severity!
    message: String!
    patient: String
    source: String
    details: [EventDetail!]!
    "ISO 8601 timestamp"
    ts: String!
  }

  type EventEdge {
    cursor: String!
    node: Event!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  type EventConnection {
    edges: [EventEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type Query {
    "Recent events, newest first."
    recentEvents(first: Int = 20, after: String, severity: Severity): EventConnection!
  }
`;

// Cursors are opaque to clients, as the Relay spec recommends.
export function encodeCursor(id: string) {
  return Buffer.from(`event:${id}`).toString('base64url');
}

function decodeCursor(cursor: string) {
  const decoded = Buffer.from(cursor, 'base64url').toString();
  if (!decoded.startsWith('event:')) throw new GraphQLError('Invalid cursor');
  return decoded.slice('event:'.length);
}

type RecentEventsArgs = { first: number; after?: string | null; severity?: HmisEvent['severity'] | null };

export const schema = createSchema({
  typeDefs,
  resolvers: {
    // GraphQL enum names map to the lowercase values used everywhere else.
    Severity: { INFO: 'info', WARNING: 'warning', CRITICAL: 'critical' },

    Event: {
      details: (event: HmisEvent) =>
        Object.entries(event.details ?? {}).map(([label, value]) => ({ label, value: String(value) })),
    },

    Query: {
      recentEvents: (_parent: unknown, { first, after, severity }: RecentEventsArgs) => {
        if (first < 1 || first > MAX_PAGE_SIZE) {
          throw new GraphQLError(`first must be between 1 and ${MAX_PAGE_SIZE}`);
        }

        const page = eventHistory.page({
          first,
          afterId: after ? decodeCursor(after) : undefined,
          severity: severity ?? undefined,
        });
        if (!page) throw new GraphQLError('Cursor has expired, start again from the first page');

        const edges = page.events.map((node) => ({ cursor: encodeCursor(node.id), node }));
        return {
          edges,
          pageInfo: { hasNextPage: page.hasNextPage, endCursor: edges.at(-1)?.cursor ?? null },
          totalCount: page.totalCount,
        };
      },
    },
  },
});
