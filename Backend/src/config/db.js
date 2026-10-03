import mongoose from 'mongoose';
import Session from '../models/Session.js';
import SessionNote from '../models/SessionNote.js';
import { seedTiersIfEmpty } from '../services/entitlementService.js';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');

    // First run only: insert the starting subscription tier configuration
    try {
      await seedTiersIfEmpty();
    } catch (seedError) {
      console.error('Subscription tier seed failed:', seedError.message);
    }

    // Drops indexes removed from the schema (e.g. the old slot index that also
    // counted cancelled sessions) and builds the current ones
    try {
      await Session.syncIndexes();
    } catch (indexError) {
      console.error('Session index sync failed:', indexError.message);
    }

    // Notes written before private/shared existed are private clinical records
    try {
      await SessionNote.updateMany({ visibility: { $exists: false } }, { $set: { visibility: 'private' } });
      await SessionNote.syncIndexes();
    } catch (noteError) {
      console.error('Session note migration failed:', noteError.message);
    }
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

export default connectDB;
