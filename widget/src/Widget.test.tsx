import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeEventSource, graphqlPage, installFakeTransports, makeEvent, requestBody, stubFetch } from './test/fakes';
import { Widget } from './Widget';

const config = { url: 'http://localhost:4000', transport: 'sse' as const, title: 'HMIS Live Feed' };

beforeEach(() => installFakeTransports());

function stream() {
  return FakeEventSource.instances[0]!;
}

describe('Widget', () => {
  it('shows the title and an empty state', () => {
    stubFetch(graphqlPage([]));
    render(<Widget config={config} />);

    expect(screen.getByText('HMIS Live Feed')).toBeInTheDocument();
    expect(screen.getByText('Waiting for events...')).toBeInTheDocument();
  });

  it('renders an event with its patient, details and source', async () => {
    stubFetch(graphqlPage([]));
    render(<Widget config={config} />);

    stream().emit(
      makeEvent({
        type: 'lab.assessed',
        severity: 'critical',
        message: 'Potassium 6.4 mmol/L is critically high for P. Otieno',
        patient: 'P. Otieno / MRN 100871',
        source: 'CityCare HMIS',
        details: { Result: '6.4 mmol/L', Flag: 'critically high' },
      }),
    );

    const item = (await screen.findByText(/Potassium 6.4/)).closest('li')!;
    expect(item).toHaveClass('critical');
    expect(within(item).getByText('P. Otieno / MRN 100871')).toBeInTheDocument();
    expect(within(item).getByText('Result')).toBeInTheDocument();
    expect(within(item).getByText('6.4 mmol/L')).toBeInTheDocument();
    expect(within(item).getByText('via CityCare HMIS')).toBeInTheDocument();
  });

  it('counts unread events while minimized and clears the count when expanded', async () => {
    stubFetch(graphqlPage([]));
    const user = userEvent.setup();
    render(<Widget config={config} />);

    await user.click(screen.getByRole('button', { name: 'Minimize live feed' }));
    stream().emit(makeEvent());
    stream().emit(makeEvent());

    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expand live feed' }));
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.getByText('2 events')).toBeInTheDocument();
  });

  it('clears the list', async () => {
    stubFetch(graphqlPage([]));
    const user = userEvent.setup();
    render(<Widget config={config} />);
    stream().emit(makeEvent({ message: 'to be cleared' }));
    await screen.findByText('to be cleared');

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.queryByText('to be cleared')).not.toBeInTheDocument();
    expect(screen.getByText('Waiting for events...')).toBeInTheDocument();
  });

  it('loads history on open and older pages on demand', async () => {
    const fetchMock = stubFetch(
      graphqlPage([makeEvent({ message: 'from history' })], { hasNextPage: true, endCursor: 'cursor-1' }),
      graphqlPage([makeEvent({ message: 'even older' })], { hasNextPage: false, endCursor: null }),
    );
    const user = userEvent.setup();
    render(<Widget config={config} />);

    expect(await screen.findByText('from history')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load older' }));

    expect(await screen.findByText('even older')).toBeInTheDocument();
    expect(requestBody(fetchMock, 1).variables.after).toBe('cursor-1');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load older' })).not.toBeInTheDocument());
  });
});
