import { describe, expect, it } from 'vitest';
import { graphqlPage, makeEvent, requestBody, stubFetch } from '../test/fakes';
import { fetchRecentEvents } from './recent-events';

const server = { url: 'https://api.example.com', token: 'widget-token' };

describe('fetchRecentEvents', () => {
  it('posts the query with the token and paging variables', async () => {
    const fetchMock = stubFetch(graphqlPage([]));
    await fetchRecentEvents(server, { first: 10, after: 'cursor-1' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.example.com/graphql');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer widget-token' });
    expect(requestBody(fetchMock).variables).toEqual({ first: 10, after: 'cursor-1' });
  });

  it('maps GraphQL nodes back to the live event shape', async () => {
    stubFetch({
      data: {
        recentEvents: {
          edges: [
            {
              node: {
                id: 'e1',
                type: 'lab.assessed',
                severity: 'CRITICAL',
                message: 'Potassium 6.4 mmol/L is critically high',
                patient: 'P. Otieno / MRN 100871',
                source: null,
                ts: '2026-11-02T08:00:00.000Z',
                details: [{ label: 'Result', value: '6.4 mmol/L' }],
              },
            },
          ],
          pageInfo: { hasNextPage: true, endCursor: 'c1' },
        },
      },
    });

    const page = await fetchRecentEvents(server);

    expect(page).toEqual({
      events: [
        {
          id: 'e1',
          type: 'lab.assessed',
          severity: 'critical',
          message: 'Potassium 6.4 mmol/L is critically high',
          patient: 'P. Otieno / MRN 100871',
          ts: '2026-11-02T08:00:00.000Z',
          details: { Result: '6.4 mmol/L' },
        },
      ],
      hasNextPage: true,
      endCursor: 'c1',
    });
  });

  it('leaves out details when there are none', async () => {
    stubFetch(graphqlPage([makeEvent()]));
    const { events } = await fetchRecentEvents(server);
    expect(events[0]).not.toHaveProperty('details');
  });

  it('throws the GraphQL error message', async () => {
    stubFetch({ errors: [{ message: 'Cursor has expired' }], data: null });
    await expect(fetchRecentEvents(server)).rejects.toThrow('Cursor has expired');
  });
});
