import mongoose from 'mongoose';

class Database {
  #uri;

  constructor(uri) {
    this.#uri = uri;
  }

  async #normalizeRefreshTokenIndexes() {
    const db = mongoose.connection.db;
    if (!db) return;

    const collections = await db
      .listCollections({ name: /^refreshtokens$/i }, { nameOnly: true })
      .toArray();

    if (collections.length === 0) {
      return;
    }

    const refreshTokens = db.collection(collections[0].name);
    const indexes = await refreshTokens.indexes();

    const tokenHashIndex = indexes.find((idx) => idx.key && idx.key.tokenHash === 1);
    const tokenIndex = indexes.find((idx) => idx.key && idx.key.token === 1);

    if (tokenHashIndex && tokenHashIndex.unique !== true) {
      await refreshTokens.dropIndex(tokenHashIndex.name);
    }

    if (!tokenHashIndex || tokenHashIndex.unique !== true) {
      await refreshTokens.createIndex({ tokenHash: 1 }, { unique: true, name: 'tokenHash_1' });
    }

    if (tokenIndex && (tokenIndex.unique !== true || tokenIndex.sparse !== true)) {
      await refreshTokens.dropIndex(tokenIndex.name);
    }

    if (!tokenIndex || tokenIndex.unique !== true || tokenIndex.sparse !== true) {
      await refreshTokens.createIndex(
        { token: 1 },
        { unique: true, sparse: true, name: 'token_1' }
      );
    }
  }

  async #normalizeRegistrationIndexes() {
    const db = mongoose.connection.db;
    if (!db) return;

    const collections = await db
      .listCollections({ name: /^registrations$/i }, { nameOnly: true })
      .toArray();

    if (collections.length === 0) {
      return;
    }

    const registrations = db.collection(collections[0].name);
    const indexes = await registrations.indexes();
    const uniqueActive = indexes.find((idx) => idx.name === 'unique_active_registration');
    const qrTokenIndex = indexes.find((idx) => idx.name === 'qrToken_1' || (idx.key && idx.key.qrToken === 1));

    if (uniqueActive) {
      await registrations.dropIndex('unique_active_registration');
    }

    if (
      qrTokenIndex
      && (
        qrTokenIndex.unique !== true
        || qrTokenIndex.sparse === true
        || !qrTokenIndex.partialFilterExpression
      )
    ) {
      await registrations.dropIndex(qrTokenIndex.name);
    }

    if (
      !qrTokenIndex
      || qrTokenIndex.unique !== true
      || qrTokenIndex.sparse === true
      || !qrTokenIndex.partialFilterExpression
    ) {
      await registrations.createIndex(
        { qrToken: 1 },
        {
          unique: true,
          partialFilterExpression: { qrToken: { $type: 'string' } },
          name: 'qrToken_1',
        }
      );
    }
  }

  async connect() {
    try {
      await mongoose.connect(this.#uri);
      await this.#normalizeRefreshTokenIndexes();
      await this.#normalizeRegistrationIndexes();
      console.log(`MongoDB connected: ${mongoose.connection.host}`);
    } catch (err) {
      console.error('MongoDB connection failed:', err.message);
      process.exit(1);
    }
  }

  async disconnect() {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
}

export default Database;
