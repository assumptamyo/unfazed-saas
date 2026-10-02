import mongoose from 'mongoose';
import Session from '../models/Session.js';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');

    // Drops indexes removed from the schema (e.g. the old slot index that also
    // counted cancelled sessions) and builds the current ones
    try {
      await Session.syncIndexes();
    } catch (indexError) {
      console.error('Session index sync failed:', indexError.message);
    }
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

export default connectDB;
