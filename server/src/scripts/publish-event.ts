// Publishes one event to RabbitMQ.
// Usage: npm run publish:event -- "Code blue, Ward 2" critical
import { config } from '../config/env.ts';
import { closeRabbitMQ, openExchangeChannel } from '../lib/rabbitmq.ts';
import { eventInputSchema } from '../modules/events/event.schema.ts';

const [message = 'Test event from publisher', severity = 'info'] = process.argv.slice(2);
const event = eventInputSchema.parse({ type: 'rabbitmq.test', severity, message });

const channel = await openExchangeChannel();
channel.publish(config.RABBITMQ_EXCHANGE, '', Buffer.from(JSON.stringify(event)));
console.log('Published:', event);

await channel.close();
await closeRabbitMQ();
