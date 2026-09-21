import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import researchRouter from './routes/research';
import historyRouter from './routes/history';

const app = express();
const PORT = process.env.PORT || 3001;

const clientUrl = process.env.CLIENT_URL?.replace(/\/+$/, '');

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, '');
      if (!clientUrl || clientUrl === '*' || cleanOrigin === clientUrl || cleanOrigin === 'http://localhost:5173' || cleanOrigin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json());

app.use('/api/research', researchRouter);
app.use('/api/history', historyRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
