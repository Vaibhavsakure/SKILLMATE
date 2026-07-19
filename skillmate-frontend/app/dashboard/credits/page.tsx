"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { getCreditBalance, getCreditHistory } from "@/lib/api";
import { Coins, History, CreditCard, TrendingUp, TrendingDown, ArrowUpRight, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";

export default function CreditsPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { token, loading: authLoading } = useAuth();

  useEffect(() => {
    const fetchCredits = async () => {
      if (!token || authLoading) return;
      try {
        const [balData, histData] = await Promise.all([
          getCreditBalance(token),
          getCreditHistory(token)
        ]);

        setBalance(balData.credits);
        setTransactions(histData.transactions);
      } catch (err) {
        console.error("Failed to fetch credits", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCredits();
  }, [token, authLoading]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-3 rounded-xl shadow-lg shadow-orange-200">
            <Coins className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Credits</h1>
            <p className="text-slate-500 text-sm">Manage your AI usage and subscription.</p>
          </div>
        </div>
      </div>

      {/* Balance Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-2 bg-gradient-to-br from-indigo-900 to-indigo-800 text-white border-none shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Coins className="h-32 w-32" />
          </div>
          <CardContent className="p-8">
            <p className="text-indigo-200 font-medium mb-1">Available Balance</p>
            <div className="flex items-baseline gap-2 mb-6">
              {loading ? (
                <div className="h-12 w-32 bg-indigo-700/50 animate-pulse rounded-lg"></div>
              ) : (
                <h2 className="text-5xl font-bold tracking-tight">{balance}</h2>
              )}
              <span className="text-indigo-300">credits</span>
            </div>
            <div className="flex gap-4">
              <Button className="bg-white text-indigo-900 hover:bg-indigo-50 border-none">
                <Zap className="mr-2 h-4 w-4" /> Top Up
              </Button>
              <Button variant="outline" className="border-indigo-400/30 text-indigo-100 hover:bg-indigo-800 hover:text-white">
                View Plans
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-center bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Quick Top Up</CardTitle>
            <CardDescription>Instant refill packs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <button className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group">
              <div className="flex items-center gap-2">
                <div className="bg-slate-100 p-2 rounded-md group-hover:bg-indigo-200"><Coins className="h-4 w-4 text-slate-600 group-hover:text-indigo-700" /></div>
                <span className="font-medium text-slate-700">100 Credits</span>
              </div>
              <span className="text-sm font-bold text-slate-900">$5.00</span>
            </button>
            <button className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group">
              <div className="flex items-center gap-2">
                <div className="bg-slate-100 p-2 rounded-md group-hover:bg-indigo-200"><Coins className="h-4 w-4 text-slate-600 group-hover:text-indigo-700" /></div>
                <span className="font-medium text-slate-700">500 Credits</span>
              </div>
              <span className="text-sm font-bold text-slate-900">$20.00</span>
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <History className="h-5 w-5 text-slate-500" /> Recent Transactions
        </h3>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 flex justify-center">
                <Loader />
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No transactions found.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {transactions.map((tx, i) => (
                  <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${tx.change < 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                        {tx.change < 0 ? (
                          <TrendingDown className={`h-4 w-4 ${tx.change < 0 ? 'text-red-600' : 'text-green-600'}`} />
                        ) : (
                          <TrendingUp className={`h-4 w-4 text-green-600`} />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{tx.reason}</p>
                        <p className="text-xs text-slate-500">{tx.created_at}</p>
                      </div>
                    </div>
                    <div className={`font-bold ${tx.change < 0 ? 'text-slate-900' : 'text-green-600'}`}>
                      {tx.change > 0 && "+"}{tx.change}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}