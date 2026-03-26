import { Kafka, logLevel } from 'kafkajs';

const rawEnabled = String(process.env.KAFKA_ENABLED || 'true').trim().toLowerCase();
const kafkaEnabled = !['false', '0', 'off', 'no'].includes(rawEnabled);
const brokers = String(process.env.KAFKA_BROKERS || 'localhost:9094')
  .split(',')
  .map((broker) => broker.trim())
  .filter(Boolean);
const clientId = String(process.env.KAFKA_CLIENT_ID || 'eventzen-node').trim();
const maxPublishAttempts = Number(process.env.KAFKA_PUBLISH_MAX_ATTEMPTS || 3);
const baseBackoffMs = Number(process.env.KAFKA_PUBLISH_BACKOFF_MS || 150);

let kafka = null;
let producer = null;
const consumers = new Set();
let producerConnected = false;
let lastKafkaError = null;
let lastPublishAt = null;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getKafka() {
  if (!kafka) {
    kafka = new Kafka({
      clientId,
      brokers,
      logLevel: logLevel.NOTHING,
    });
  }
  return kafka;
}

export function isKafkaEnabled() {
  return kafkaEnabled && brokers.length > 0;
}

export async function connectKafkaProducer() {
  if (!isKafkaEnabled()) return null;
  if (producer) return producer;

  producer = getKafka().producer();
  await producer.connect();
  producerConnected = true;
  lastKafkaError = null;
  return producer;
}

export async function publishEvent(topic, key, payload, headers = {}) {
  if (!isKafkaEnabled()) return false;

  let lastError = null;

  for (let attempt = 1; attempt <= Math.max(1, maxPublishAttempts); attempt += 1) {
    try {
      const activeProducer = await connectKafkaProducer();
      await activeProducer.send({
        topic,
        messages: [
          {
            key: String(key || ''),
            value: JSON.stringify(payload || {}),
            headers,
          },
        ],
      });
      lastKafkaError = null;
      lastPublishAt = new Date().toISOString();
      return true;
    } catch (err) {
      lastError = err;
      producerConnected = false;
      lastKafkaError = String(err?.message || err);
      if (attempt < Math.max(1, maxPublishAttempts)) {
        await delay(baseBackoffMs * attempt);
      }
    }
  }

  throw lastError;
}

export async function startKafkaConsumer({ groupId, topics, onMessage }) {
  if (!isKafkaEnabled()) return null;

  const consumer = getKafka().consumer({ groupId });
  await consumer.connect();
  lastKafkaError = null;

  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const rawValue = message?.value?.toString?.() || '{}';
      let payload = {};
      try {
        payload = JSON.parse(rawValue);
      } catch {
        payload = { rawValue };
      }

      await onMessage({
        topic,
        key: message?.key?.toString?.() || '',
        payload,
        headers: message?.headers || {},
      });
    },
  });

  consumers.add(consumer);
  return consumer;
}

export async function stopKafka() {
  const tasks = [];

  for (const consumer of consumers) {
    tasks.push(consumer.disconnect().catch(() => undefined));
  }
  consumers.clear();

  if (producer) {
    tasks.push(producer.disconnect().catch(() => undefined));
    producer = null;
    producerConnected = false;
  }

  await Promise.all(tasks);
}

export function getKafkaRuntimeState() {
  return {
    enabled: isKafkaEnabled(),
    brokers,
    clientId,
    producerConnected,
    consumerCount: consumers.size,
    lastPublishAt,
    lastError: lastKafkaError,
  };
}
