import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
export async function connectDB(uri = env.MONGO_URI) {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri);
    logger.info(`MongoDB connected: ${mongoose.connection.name}`);
}
export async function disconnectDB() {
    await mongoose.disconnect();
}
//# sourceMappingURL=db.js.map