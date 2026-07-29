import express from 'express';
import cors from 'cors';
import { corsOrigins } from './config/env';
import { errorHandler, notFound } from './middleware/errorHandler';
import { serveUpload } from './lib/uploads';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import residentRoutes from './routes/residents';
import billRoutes from './routes/bills';
import transactionRoutes from './routes/transactions';
import serviceRoutes from './routes/services';
import notificationRoutes from './routes/notifications';
import dashboardRoutes from './routes/dashboard';
import paymentRoutes from './routes/payments';
import serviceTypeRoutes from './routes/serviceTypes';
import unitTypeRoutes from './routes/unitTypes';
import expenseTypeRoutes from './routes/expenseTypes';
import expenseRoutes from './routes/expenses';
import contactRequestRoutes from './routes/contactRequests';
import dependentRoutes from './routes/dependents';
import chatRoutes from './routes/chats';

const app = express();

app.use(cors({ origin: corsOrigins(), credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Public uploads (disk first, then DB blob for chat files)
app.use('/uploads', serveUpload);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/residents', residentRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/service-types', serviceTypeRoutes);
app.use('/api/unit-types', unitTypeRoutes);
app.use('/api/expense-types', expenseTypeRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/contact-requests', contactRequestRoutes);
app.use('/api/dependents', dependentRoutes);
app.use('/api/chats', chatRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
