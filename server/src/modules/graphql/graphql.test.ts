import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.ts';
import { eventHistory } from '../events/event-history.ts';
import { createEvent } from '../events/event.schema.ts';

let server: Server;
let endpoint: string;

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/graphql`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  eventHistory.clear();
  for (const [i, severity] of (['info', 'warning', 'critical'] as const).entries()) {
    eventHistory.add(
      createEvent({ type: 'lab.assessed', severity, message: `event ${i}`, details: { Ward: '3B', Bed: 12 } }),
    );
  }
});

async function query(body: { query: string; variables?: object }, token = 'test-widget-token') {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

const RECENT_EVENTS = /* GraphQL */ `
  query ($first: Int, $after: String, $severity: Severity) {
    recentEvents(first: $first, after: $after, severity: $severity) {
      totalCount
      edges { cursor node { message severity details { label value } } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

describe('POST /graphql', () => {
  it('rejects requests without a valid widget token', async () => {
    const { status } = await query({ query: '{ recentEvents { totalCount } }' }, 'wrong-token');
    expect(status).toBe(401);
  });

  it('returns a Relay-style connection with string detail values', async () => {
    const { json } = await query({ query: RECENT_EVENTS, variables: { first: 1 } });
    const connection = json.data.recentEvents;

    expect(connection.totalCount).toBe(3);
    expect(connection.edges[0].node).toEqual({
      message: 'event 2',
      severity: 'CRITICAL',
      details: [
        { label: 'Ward', value: '3B' },
        { label: 'Bed', value: '12' },
      ],
    });
    expect(connection.pageInfo).toEqual({ hasNextPage: true, endCursor: connection.edges[0].cursor });
  });

  it('pages with the endCursor from the previous page', async () => {
    const first = await query({ query: RECENT_EVENTS, variables: { first: 2 } });
    const next = await query({
      query: RECENT_EVENTS,
      variables: { first: 2, after: first.json.data.recentEvents.pageInfo.endCursor },
    });

    expect(next.json.data.recentEvents.edges.map((e: { node: { message: string } }) => e.node.message)).toEqual([
      'event 0',
    ]);
    expect(next.json.data.recentEvents.pageInfo.hasNextPage).toBe(false);
  });

  it('filters by severity', async () => {
    const { json } = await query({ query: RECENT_EVENTS, variables: { severity: 'WARNING' } });
    expect(json.data.recentEvents.totalCount).toBe(1);
    expect(json.data.recentEvents.edges[0].node.severity).toBe('WARNING');
  });

  it('rejects page sizes over 50 and malformed cursors', async () => {
    const tooBig = await query({ query: RECENT_EVENTS, variables: { first: 500 } });
    expect(tooBig.json.errors[0].message).toMatch(/between 1 and 50/);

    const badCursor = await query({ query: RECENT_EVENTS, variables: { after: 'not-a-cursor' } });
    expect(badCursor.json.errors[0].message).toBe('Invalid cursor');
  });
});
