import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const TEST_USERS = [
  { name: 'Admin User', email: 'admin@ez.local', role: 'ADMIN' },
  { name: 'Vendor User', email: 'vendor@ez.local', role: 'VENDOR' },
  { name: 'Regular User', email: 'user@ez.local', role: 'CUSTOMER' },
];

const DEFAULT_PASSWORD = 'Eventzen@2026!';

async function seedUsers() {
  const mongoUri = String(process.env.MONGO_URI || '').trim();
  if (!mongoUri) {
    throw new Error('MONGO_URI is required for seeding users.');
  }

  const password = String(process.env.TEST_USER_PASSWORD || DEFAULT_PASSWORD);

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Mongo connection established but db handle is unavailable.');
  }

  const usersCollection = db.collection('users');
  const now = new Date();
  const passwordHash = await bcrypt.hash(password, 12);

  let inserted = 0;
  let updated = 0;

  for (const user of TEST_USERS) {
    const normalizedEmail = user.email.toLowerCase();
    const result = await usersCollection.updateOne(
      { email: normalizedEmail },
      {
        $set: {
          name: user.name,
          email: normalizedEmail,
          role: user.role,
          passwordHash,
          isEmailVerified: true,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
          avatarUrl: null,
          phoneNumber: null,
        },
      },
      { upsert: true }
    );

    inserted += Number(result.upsertedCount || 0);

    if (!result.upsertedCount && (result.matchedCount > 0 || result.modifiedCount > 0)) {
      updated += 1;
    }
  }

  const seededUsers = await usersCollection.find(
    { email: { $in: TEST_USERS.map((u) => u.email.toLowerCase()) } },
    { projection: { _id: 0, name: 1, email: 1, role: 1, isEmailVerified: 1 } }
  ).toArray();

  console.log(`[user-seed] completed inserted=${inserted} updated=${updated} total=${TEST_USERS.length}`);
  console.log(`[user-seed] users=${JSON.stringify(seededUsers)}`);
}

async function run() {
  try {
    await seedUsers();
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(`[user-seed] failed: ${err?.message || err}`);
    try {
      await mongoose.disconnect();
    } catch {
      // no-op: connection may not be open
    }
    process.exit(1);
  }
}

run();
