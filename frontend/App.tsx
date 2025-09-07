import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './pages/Dashboard';
import Networks from './pages/Networks';
import SmartContracts from './pages/SmartContracts';
import Wallets from './pages/Wallets';
import Tokens from './pages/Tokens';
import NFTMarketplace from './pages/NFTMarketplace';
import Transactions from './pages/Transactions';
import Analytics from './pages/Analytics';
import Events from './pages/Events';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppInner() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <div className="flex">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 p-6 overflow-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/networks" element={<Networks />} />
                <Route path="/contracts" element={<SmartContracts />} />
                <Route path="/wallets" element={<Wallets />} />
                <Route path="/tokens" element={<Tokens />} />
                <Route path="/marketplace" element={<NFTMarketplace />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/events" element={<Events />} />
              </Routes>
            </main>
          </div>
        </div>
        <Toaster />
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}
