import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { MultivariateLinearRegression } from 'ml-regression';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Simulated Data Generation for Indian Stocks
  const stocks = ['TCS', 'Reliance', 'Infosys', 'HDFC Bank', 'ICICI Bank', 'Wipro'];
  
  const generateSimulatedData = (stockName: string) => {
    const data = [];
    let basePrice = 0;
    switch(stockName) {
      case 'TCS': basePrice = 3500; break;
      case 'Reliance': basePrice = 2500; break;
      case 'Infosys': basePrice = 1500; break;
      case 'HDFC Bank': basePrice = 1600; break;
      case 'ICICI Bank': basePrice = 900; break;
      case 'Wipro': basePrice = 450; break;
      default: basePrice = 1000;
    }

    for (let i = 0; i < 30; i++) {
      const open = basePrice + (Math.random() * 50 - 25);
      const high = open + (Math.random() * 20);
      const low = open - (Math.random() * 20);
      const close = (high + low) / 2 + (Math.random() * 10 - 5);
      const volume = Math.floor(Math.random() * 1000000) + 500000;
      
      data.push({
        date: new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        open,
        high,
        low,
        close,
        volume
      });
      basePrice = close; // Walk the price
    }
    return data;
  };

  // API Routes
  app.get('/api/stocks', (req, res) => {
    res.json(stocks);
  });

  app.get('/api/stock-data/:symbol', (req, res) => {
    const { symbol } = req.params;
    if (!stocks.includes(symbol)) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    res.json(generateSimulatedData(symbol));
  });

  app.post('/api/predict', (req, res) => {
    const { symbol, open, high, low, volume, customTargetDate } = req.body;
    
    if (!symbol || open === undefined || high === undefined || low === undefined || volume === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const historicalData = generateSimulatedData(symbol);
    
    // Multivariate model for standard short-term prediction
    const X_multi = historicalData.map(d => [d.open, d.high, d.low, d.volume]);
    const y_multi = historicalData.map(d => [d.close]);
    const regressionMulti = new MultivariateLinearRegression(X_multi, y_multi);
    const multiPrediction = regressionMulti.predict([Number(open), Number(high), Number(low), Number(volume)])[0];

    // Linear Trend model for any-day projection
    const prices = historicalData.map(d => d.close);
    const n = prices.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += prices[i];
      sumXY += i * prices[i];
      sumXX += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate Target Date and Days Offset
    const now = new Date();
    let targetDate = customTargetDate ? new Date(customTargetDate) : new Date();
    
    if (!customTargetDate) {
      targetDate.setDate(targetDate.getDate() + 1);
      // Skip weekends for default next-day
      if (targetDate.getDay() === 6) targetDate.setDate(targetDate.getDate() + 2);
      else if (targetDate.getDay() === 0) targetDate.setDate(targetDate.getDate() + 1);
    }

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
    const daysDiff = Math.max(1, Math.ceil((targetStart - todayStart) / (1000 * 60 * 60 * 24)));

    // If it's the immediate next market day, use the multivariate model (more accurate for market conditions)
    // Otherwise, use the linear trend projection
    let finalPrediction = 0;
    if (daysDiff === 1) {
      finalPrediction = multiPrediction;
    } else {
      // Index for target is current last index (n-1) + daysDiff
      const targetIndex = (n - 1) + daysDiff;
      finalPrediction = slope * targetIndex + intercept;
    }
    
    res.json({
      symbol,
      predictedClose: finalPrediction,
      currency: 'INR',
      timestamp: new Date().toISOString(),
      targetDate: targetDate.toISOString().split('T')[0]
    });
  });

  app.post('/api/save-model', (req, res) => {
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: 'Symbol required' });

    const historicalData = generateSimulatedData(symbol);
    const X = historicalData.map(d => [d.open, d.high, d.low, d.volume]);
    const y = historicalData.map(d => [d.close]);
    const regression = new MultivariateLinearRegression(X, y);

    try {
      // Serialize the model to JSON
      const modelData = regression.toJSON();
      const filePath = path.join(process.cwd(), 'trained_model.json');
      fs.writeFileSync(filePath, JSON.stringify(modelData, null, 2));
      
      res.json({ 
        message: 'Model saved successfully', 
        path: filePath,
        format: 'JSON (Node.js Serialized)'
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save model' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
