import test from 'node:test';
import assert from 'node:assert/strict';
import { Kafka, logLevel } from 'kafkajs';

function waitFor(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('publishes and consumes message through Kafka broker', { skip: process.env.RUN_KAFKA_INTEGRATION !== 'true' }, async (t) => {
  const brokers = String(process.env.KAFKA_BROKERS || 'localhost:9094')
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);

  const kafkaProbe = new Kafka({
    clientId: `eventzen-node-integration-probe-${Date.now()}`,
    brokers,
    logLevel: logLevel.NOTHING,
  });

  const admin = kafkaProbe.admin();
  try {
    await admin.connect();
  } catch {
    t.skip('Kafka broker is not reachable. Start docker compose and re-run with RUN_KAFKA_INTEGRATION=true.');
    return;
  } finally {
    await admin.disconnect().catch(() => undefined);
  }

  process.env.KAFKA_ENABLED = 'true';
  process.env.KAFKA_BROKERS = brokers.join(',');
  process.env.KAFKA_CLIENT_ID = `eventzen-node-integration-${Date.now()}`;

  const topic = `eventzen.integration.${Date.now()}`;
  const groupId = `eventzen-node-integration-group-${Date.now()}`;

  const bus = await import(`./kafkaBus.js?it=${Date.now()}`);

  const received = [];
  let resolveReceived;
  const receivedPromise = new Promise((resolve, reject) => {
    resolveReceived = resolve;
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for Kafka message'));
    }, 15000);
    resolveReceived = () => {
      if (received.length > 0) {
        clearTimeout(timeout);
        resolve();
      }
    };
  });

  try {
    await bus.startKafkaConsumer({
      groupId,
      topics: [topic],
      onMessage: async (message) => {
        received.push(message);
        if (resolveReceived) {
          resolveReceived();
        }
      },
    });

    await waitFor(250);

    await bus.publishEvent(topic, 'integration-key', {
      eventType: 'INTEGRATION_TEST',
      occurredAt: new Date().toISOString(),
    });

    await receivedPromise;

    assert.equal(received.length, 1);
    assert.equal(received[0].key, 'integration-key');
    assert.equal(received[0].payload.eventType, 'INTEGRATION_TEST');
  } finally {
    await bus.stopKafka();
  }
});
