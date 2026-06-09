const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const Transaction = require('../models/Transaction');

// Robust .env loader
const envPaths = [
  path.join(__dirname, '..', '.env'),      // server/.env
  path.join(__dirname, '..', '..', '.env'), // root/.env
  path.join(process.cwd(), '.env'),         // current working dir/.env
  path.join(process.cwd(), 'server', '.env') // current working dir/server/.env
];

let envLoaded = false;
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    console.log(`Loading .env from: ${p}`);
    const result = dotenv.config({ path: p });
    if (result.error) {
      console.error(`Error loading .env from ${p}:`, result.error);
    } else {
      envLoaded = true;
      break;
    }
  }
}

if (!process.env.MONGO_URI) {
  console.error('CRITICAL: MONGO_URI is undefined! Please check if server/.env exists and contains MONGO_URI.');
  process.exit(1);
}

async function removePending() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    const result = await Transaction.deleteMany({ status: 'pending' });
    console.log(`Successfully deleted ${result.deletedCount} pending transactions.`);

    process.exit(0);
  } catch (err) {
    console.error('Error deleting pending transactions:', err);
    process.exit(1);
  }
}

removePending();
