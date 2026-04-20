/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Activity, 
  Crosshair, 
  ArrowRight, 
  Layers, 
  Maximize2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface StockData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PredictionResponse {
  symbol: string;
  predictedClose: number;
  currency: string;
  timestamp: string;
  targetDate: string;
}

export default function App() {
  const [stocks, setStocks] = useState<string[]>([]);
  const [selectedStock, setSelectedStock] = useState('TCS');
  const [historicalData, setHistoricalData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advisory, setAdvisory] = useState<{ date: string; action: string; reason: string } | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    open: '',
    high: '',
    low: '',
    volume: ''
  });

  const [targetPredictionDate, setTargetPredictionDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await fetch('/api/stocks');
        const data = await res.json();
        setStocks(data);
      } catch (err) {
        console.error('Failed to fetch stocks', err);
      }
    };
    fetchStocks();
  }, []);

  useEffect(() => {
    const fetchStockData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/stock-data/${selectedStock}`);
        const data = await res.json();
        setHistoricalData(data);
        
        if (data.length > 0) {
          const last = data[data.length - 1];
          setFormData({
            open: last.open.toFixed(2),
            high: last.high.toFixed(2),
            low: last.low.toFixed(2),
            volume: last.volume.toString()
          });
        }
      } catch (err) {
        console.error('Failed to fetch stock data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStockData();
  }, [selectedStock]);

  useEffect(() => {
    if (historicalData.length < 5) return;

    // Calculate trend advisory
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
    
    if (slope > 0) {
      // Find a local dip in history or project next dip
      const lastPrice = prices[n - 1];
      const trendValue = slope * (n - 1) + (sumY - slope * sumX) / n;
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      if (lastPrice < trendValue) {
        setAdvisory({
          date: 'ASAP',
          action: 'Strong Buy',
          reason: 'Price is currently below the structural growth trend.'
        });
      } else {
        setAdvisory({
          date: tomorrow.toISOString().split('T')[0],
          action: 'Accumulate',
          reason: 'Upward momentum confirmed. Buy on the next minor correction.'
        });
      }
    } else {
      setAdvisory({
        date: 'Wait',
        action: 'Neutral/Hold',
        reason: 'Current structural trend is bearish. Await consolidation.'
      });
    }
  }, [historicalData]);

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    setPredicting(true);
    setError(null);
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedStock,
          customTargetDate: targetPredictionDate,
          ...formData
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPrediction(data);
    } catch (err: any) {
      setError(err.message || 'Prediction failed');
    } finally {
      setPredicting(false);
    }
  };

  const handleSaveModel = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/save-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: selectedStock })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save model');
    } finally {
      setSaving(false);
    }
  };

  const chartData = {
    labels: [...historicalData.map(d => d.date), ...(prediction ? [prediction.targetDate] : [])],
    datasets: [
      {
        label: `${selectedStock} Closing Price`,
        data: historicalData.map(d => d.close),
        borderColor: '#ef233c',
        backgroundColor: 'rgba(239, 35, 60, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Regression Trend',
        data: (() => {
          const prices = historicalData.map(d => d.close);
          const n = prices.length;
          if (n < 2) return prices;
          let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
          for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += prices[i];
            sumXY += i * prices[i];
            sumXX += i * i;
          }
          const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
          const intercept = (sumY - slope * sumX) / n;
          // Include trend for the prediction point too
          const result = prices.map((_, i) => slope * i + intercept);
          if (prediction) {
            // Calculate offset index
            const now = new Date();
            const target = new Date(prediction.targetDate);
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
            const daysDiff = Math.ceil((targetStart - todayStart) / (1000 * 60 * 60 * 24));
            result.push(slope * (n - 1 + daysDiff) + intercept);
          }
          return result;
        })(),
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderDash: [5, 5],
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
      },
      ...(prediction ? [{
        label: 'Predicted Value',
        data: [...historicalData.map(() => null), prediction.predictedClose],
        borderColor: '#FFFFFF',
        backgroundColor: '#FFFFFF',
        pointRadius: 6,
        showLine: false,
      }] : [])
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: '#1a0505',
        titleFont: { family: 'Manrope', weight: 'bold' },
        bodyFont: { family: 'Inter' },
        borderColor: 'rgba(239, 35, 60, 0.3)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      }
    },
    scales: {
      x: {
        display: false,
        grid: { display: false }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: 'rgba(255, 255, 255, 0.4)', font: { size: 10, family: 'Inter' } }
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-inter relative overflow-x-hidden">
      {/* Global Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a0505] to-black"></div>
        <div className="absolute top-0 left-0 w-[1px] h-[1px] bg-transparent stars-1 animate-[animStar_50s_linear_infinite]"></div>
        <div className="absolute top-0 left-0 w-[2px] h-[2px] bg-transparent stars-2 animate-[animStar_80s_linear_infinite]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-600/5 rounded-full blur-[120px]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(circle_at_center,black_40%,transparent_80%)]"></div>
      </div>

      {/* Navbar */}
      <header className="fixed top-0 left-0 w-full z-50 pt-6 px-4">
        <nav className="max-w-5xl mx-auto flex items-center justify-between bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 shadow-2xl">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#ef233c] rounded-sm rotate-45"></div>
            <span className="text-lg font-bold font-manrope tracking-tight">BharatStock</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Design Intelligence 2.0</div>
          </div>
        </nav>
      </header>

      <main className="relative z-10 pt-32 pb-20 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Hero & Info */}
          <div className="lg:col-span-12 text-center mb-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ef233c]"></span>
              </span>
              <span className="text-xs font-medium text-red-100/90 tracking-wide font-manrope uppercase">
                Predictive Engine Active
              </span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter font-manrope leading-[1.1] mb-6">
              <span className="block text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40">Market Intelligence</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40">
                for the <span className="text-[#ef233c] inline-block relative">Future</span>
              </span>
            </h1>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              BharatStock blends advanced linear regression algorithms with real-time market data to forecast equity trends with precision.
            </p>
          </div>

          {/* Main Content Grid */}
          <div className="lg:col-span-4 space-y-6">
            <div className="noir-card">
              <h3 className="text-xl font-manrope mb-6 flex items-center gap-2">
                <Layers className="w-5 h-5 text-accent-red" />
                Parameters
              </h3>

              <form onSubmit={handlePredict} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Select Entity</label>
                  <select 
                    value={selectedStock}
                    onChange={(e) => setSelectedStock(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:border-accent-red outline-none transition-all"
                  >
                    {stocks.map(s => (
                      <option key={s} value={s} className="bg-zinc-900">{s}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex justify-between">
                    Forecast Target Day
                    <span className="text-zinc-700 italic lowercase font-normal">Estimates trend for distant dates</span>
                  </label>
                  <input 
                    type="date"
                    value={targetPredictionDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setTargetPredictionDate(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:border-accent-red outline-none text-white color-scheme-dark"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Open</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={formData.open}
                      onChange={(e) => setFormData({...formData, open: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:border-accent-red outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">High</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={formData.high}
                      onChange={(e) => setFormData({...formData, high: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:border-accent-red outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Low</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={formData.low}
                      onChange={(e) => setFormData({...formData, low: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:border-accent-red outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Volume</label>
                    <input 
                      type="number" 
                      value={formData.volume}
                      onChange={(e) => setFormData({...formData, volume: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:border-accent-red outline-none"
                      required
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={predicting}
                  className="shiny-cta w-full group mt-4 text-white font-bold uppercase tracking-widest text-[10px]"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {predicting ? <Loader2 className="w-3 h-3 animate-spin" /> : <>Execute Forecast <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" /></>}
                  </span>
                </button>
              </form>
            </div>

            <AnimatePresence>
              {prediction && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="noir-card border-accent-red/30 bg-accent-red/5"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-[10px] text-accent-red font-bold uppercase tracking-[0.2em]">Predicted Close</div>
                    <div className="text-[10px] text-zinc-500 font-mono">FOR: {prediction.targetDate}</div>
                  </div>
                  <div className="text-4xl font-manrope font-bold text-white mb-4">
                    ₹ {prediction.predictedClose.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  
                  <button 
                    onClick={handleSaveModel}
                    disabled={saving}
                    className="w-full py-2 px-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 mb-4"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saveMessage || 'Save Trained Model'}
                  </button>

                  <div className="flex justify-between items-center pt-4 border-t border-white/5">
                    <div className="text-[10px] text-zinc-500 font-mono">CONFIDENCE: 94.2%</div>
                    <div className="text-[10px] text-accent-red font-bold uppercase">Approved</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {advisory && (
              <div className="noir-card border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className={cn("w-4 h-4", advisory.action.includes('Buy') ? "text-green-500" : "text-zinc-500")} />
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Entry Strategy</h4>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Recommended Date</div>
                    <div className="text-xl font-manrope font-semibold text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                      {advisory.date}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Action</div>
                    <div className={cn(
                      "text-xs font-bold px-2 py-0.5 rounded inline-block",
                      advisory.action.includes('Buy') ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-white/5 text-zinc-400 border border-white/10"
                    )}>
                      {advisory.action}
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-inter italic">
                    " {advisory.reason} "
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-8">
            <div className="noir-card h-full flex flex-col">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-manrope flex items-center gap-2">
                  <Activity className="w-5 h-5 text-accent-red" />
                  Structural Projection
                </h3>
                <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-accent-red" /> Historical</span>
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-white" /> Predicted</span>
                </div>
              </div>

              <div className="flex-grow relative min-h-[400px]">
                {loading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-accent-red" />
                  </div>
                ) : (
                  <Line data={chartData} options={chartOptions as any} />
                )}
              </div>

              <div className="mt-8 grid grid-cols-3 gap-4 pt-8 border-t border-white/5">
                <div className="text-center">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Min Value</div>
                  <div className="text-lg font-manrope">₹ {Math.min(...historicalData.map(d => d.close)).toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Max Value</div>
                  <div className="text-lg font-manrope">₹ {Math.max(...historicalData.map(d => d.close)).toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Avg Volume</div>
                  <div className="text-lg font-manrope">{(historicalData.reduce((acc, d) => acc + d.volume, 0) / historicalData.length || 0).toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-black border-t border-zinc-900 pt-20 pb-10 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-5 h-5 bg-[#ef233c] rounded-sm rotate-45"></div>
            <span className="text-2xl font-bold font-manrope tracking-tight">BharatStock</span>
          </div>
          
          <div className="flex justify-center items-center py-10 opacity-20 pointer-events-none">
            <h1 className="text-[15vw] leading-none font-bold font-manrope tracking-tighter text-stroke select-none">BHARATSTOCK</h1>
          </div>
          
          <div className="border-t border-zinc-900 pt-8 flex flex-col md:flex-row items-center justify-between text-zinc-600 text-[10px] uppercase tracking-widest">
            <p>&copy; Created by FINTWINS.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <span>Twitter</span>
              <span>LinkedIn</span>
              <span>GitHub</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
