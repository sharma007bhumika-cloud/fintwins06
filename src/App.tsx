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
  
  // Form state
  const [formData, setFormData] = useState({
    open: '',
    high: '',
    low: '',
    volume: ''
  });

  // Mouse coordinates for the "Blueprint" effect
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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
    labels: historicalData.map(d => d.date),
    datasets: [
      {
        label: `${selectedStock} Closing Price`,
        data: historicalData.map(d => d.close),
        borderColor: '#FFFFFF',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        pointRadius: 2,
        pointBackgroundColor: '#00FFFF',
        fill: true,
        tension: 0.1,
      },
      ...(prediction ? [{
        label: 'Predicted Next Close',
        data: [...historicalData.map(() => null), prediction.predictedClose],
        borderColor: '#FF3333',
        backgroundColor: '#FF3333',
        pointRadius: 6,
        pointStyle: 'crossRot',
        showLine: false,
      }] : [])
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: {
          color: 'rgba(255, 255, 255, 0.6)',
          font: { family: 'Roboto Mono', size: 10 }
        }
      },
      tooltip: {
        backgroundColor: '#003366',
        titleFont: { family: 'Architects Daughter' },
        bodyFont: { family: 'Roboto Mono' },
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: 'rgba(255, 255, 255, 0.4)', font: { size: 9 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: 'rgba(255, 255, 255, 0.4)', font: { size: 9 } }
      }
    }
  };

  return (
    <div 
      className="h-screen w-screen relative overflow-hidden flex flex-col p-10 gap-5"
      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
    >
      {/* Header */}
      <header className="blueprint-border h-[100px] shrink-0 flex justify-between items-center px-6">
        <div className="header-title">
          <h1 className="text-3xl font-blueprint text-white">BHARATSTOCK_ARCHITECT_v1.0</h1>
        </div>
        <div className="text-right text-[10px] text-cyan-measure font-mono uppercase leading-tight">
          PROJECT: ARCHITECTURAL_STOCK_PREDICTOR<br />
          SCALE: 1:1 [LINEAR_REGRESSION]<br />
          DATE: {new Date().toISOString().split('T')[0]}
        </div>
      </header>

      <div className="flex-grow flex gap-5 min-h-0">
        {/* Sidebar */}
        <aside className="blueprint-border w-[320px] shrink-0 p-6 relative corner-plus">
          <div className="dimension-line-horiz -top-8">
            <span className="bg-blueprint-blue px-2 text-[10px] text-cyan-measure">SPECIFICATIONS: 320mm</span>
          </div>

          <form onSubmit={handlePredict} className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] text-cyan-measure font-mono uppercase">Selection_Symbol</label>
              <select 
                value={selectedStock}
                onChange={(e) => setSelectedStock(e.target.value)}
                className="w-full bg-transparent border border-drafting-white p-2 text-sm text-white outline-none"
              >
                {stocks.map(s => (
                  <option key={s} value={s} className="bg-blueprint-blue">{s}</option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-cyan-measure font-mono uppercase">Input_Open (₹)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={formData.open}
                  onChange={(e) => setFormData({...formData, open: e.target.value})}
                  className="w-full bg-transparent border border-drafting-white p-2 text-sm text-white outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-cyan-measure font-mono uppercase">Input_High (₹)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={formData.high}
                  onChange={(e) => setFormData({...formData, high: e.target.value})}
                  className="w-full bg-transparent border border-drafting-white p-2 text-sm text-white outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-cyan-measure font-mono uppercase">Input_Low (₹)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={formData.low}
                  onChange={(e) => setFormData({...formData, low: e.target.value})}
                  className="w-full bg-transparent border border-drafting-white p-2 text-sm text-white outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-cyan-measure font-mono uppercase">Input_Volume</label>
                <input 
                  type="number" 
                  value={formData.volume}
                  onChange={(e) => setFormData({...formData, volume: e.target.value})}
                  className="w-full bg-transparent border border-drafting-white p-2 text-sm text-white outline-none"
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={predicting}
              className="w-full bg-white text-blueprint-blue py-3 font-bold uppercase tracking-widest text-xs hover:bg-cyan-measure transition-colors disabled:opacity-50"
            >
              {predicting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'GENERATE_FORECAST'}
            </button>

            <button 
              type="button"
              onClick={handleSaveModel}
              disabled={saving}
              className="w-full border border-redline text-redline py-2 font-bold uppercase tracking-widest text-[9px] hover:bg-redline/10 transition-colors mt-2"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : saveMessage || 'ARCHIVE_MODERN_STATE (Pickle)'}
            </button>
          </form>
          
          <div className="annotation bottom-4 left-6 italic text-[9px] text-drafting-white opacity-40">
            * ARCHITECTURAL DRAFT v1.02
          </div>
        </aside>

        {/* Main Content */}
        <main className="blueprint-border flex-grow p-6 relative bg-white/5">
          <div className="dimension-line-horiz -top-2">
            <span className="bg-blueprint-blue px-2 text-[10px] text-cyan-measure">STATISTICAL_RENDER_PLANE</span>
          </div>

          <div className="h-full w-full border border-dashed border-drafting-white relative p-5">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-measure" />
              </div>
            ) : (
              <Line data={chartData} options={chartOptions as any} />
            )}

            {/* Annotations */}
            <div className="annotation top-10 right-10 w-40 rotate-2">
              * Regression analysis suggests trend alignment with historical metrics.
            </div>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="blueprint-border h-[120px] shrink-0 flex">
        <div className="flex-grow border-r-2 border-drafting-white flex items-center px-10 gap-10">
          <span className="text-sm text-cyan-measure uppercase font-mono tracking-widest">Calculated_Projection [INR]:</span>
          <span className="text-4xl font-bold text-cyan-measure font-mono">
            {prediction ? `₹ ${prediction.predictedClose.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹ [PENDING]'}
          </span>
        </div>
        <div className="w-[300px] flex flex-col justify-center items-center gap-1">
          <div className="stamp">APPROVED</div>
          <div className="text-[10px] text-white/60 font-mono tracking-tighter">DESIGNED BY: FINTWINS</div>
          <div className="text-[10px] text-white/60 font-mono">ENGR_REF: BLU-PRN-99</div>
        </div>
      </footer>

      {/* Cursor Crosshair Info */}
      <div 
        className="fixed pointer-events-none z-50 bg-blueprint-blue/80 border border-cyan-measure/20 px-2 py-1 text-[10px] text-cyan-measure font-mono"
        style={{ left: mousePos.x + 15, top: mousePos.y + 15 }}
      >
        X:{mousePos.x} Y:{mousePos.y}
      </div>
    </div>
  );
}
