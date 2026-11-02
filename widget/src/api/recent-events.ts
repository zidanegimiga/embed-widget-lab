import type { HmisEvent, WidgetConfig } from '../types';

// A typed fetch call rather than Relay or Apollo: the widget is embedded on other people's
// sites and runs one query, so a GraphQL client library would add tens of KB for nothing.
// The server follows the Relay connection spec, so swapping in Relay later needs no API change.
const RECENT_EVENTS_QUERY = /* GraphQL */ `
  query RecentEvents($first: Int!, $after: String) {
    recentEvents(first: $first, after: $after) {
      edges {
        node { id type severity message patient source ts details { label value } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

type EventNode = Omit<HmisEvent, 'severity' | 'details'> & {
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  details: { label: string; value: string }[];
};

type RecentEventsResponse = {
  data?: {
    recentEvents: {
      edges: { node: EventNode }[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
  errors?: { message: string }[];
};

export interface EventPage {
  events: HmisEvent[];
  hasNextPage: boolean;
  endCursor: string | null;
}

/** Maps a GraphQL node back to the same shape the live stream delivers. */
function toHmisEvent({ severity, details, patient, source, ...rest }: EventNode): HmisEvent {
  return {
    ...rest,
    severity: severity.toLowerCase() as HmisEvent['severity'],
    ...(patient != null && { patient }),
    ...(source != null && { source }),
    ...(details.length > 0 && { details: Object.fromEntries(details.map((d) => [d.label, d.value])) }),
  };
}

export async function fetchRecentEvents(
  { url, token }: Pick<WidgetConfig, 'url' | 'token'>,
  { first = 20, after }: { first?: number; after?: string | null } = {},
  signal?: AbortSignal,
): Promise<EventPage> {
  const response = await fetch(`${url}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ query: RECENT_EVENTS_QUERY, variables: { first, after: after ?? null } }),
    signal,
  });
  if (!response.ok) throw new Error(`History request failed (${response.status})`);

  const body = (await response.json()) as RecentEventsResponse;
  if (body.errors?.length || !body.data) throw new Error(body.errors?.[0]?.message ?? 'Empty GraphQL response');

  const { edges, pageInfo } = body.data.recentEvents;
  return { events: edges.map((e) => toHmisEvent(e.node)), ...pageInfo };
}
