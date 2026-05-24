"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface Lead {
  id: number;
  customerName: string;
  phone: string;
  city: string;
  description: string;
  createdAt: string;
  service: {
    id: number;
    name: string;
  };
}

interface Assignment {
  id: number;
  assignedAt: string;
  lead: Lead;
}

interface Provider {
  id: number;
  name: string;
  monthlyQuota: number;
  currentMonthLeads: number;
  allocationIndex: number;
  assignments: Assignment[];
}

export default function DashboardPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch all providers and their details
  const fetchDashboardData = async () => {
    try {
      const response = await fetch("/api/dashboard");
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard statistics.");
      }
      const data = await response.json();
      setProviders(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchDashboardData();

    // 1. Establish robust fallback polling interval (runs every 4 seconds)
    // This guarantees automatic updates within a few seconds even on Serverless platforms (like Vercel)
    // where persistent SSE stream clients may be split across isolated serverless function containers.
    const pollingInterval = setInterval(() => {
      fetchDashboardData();
    }, 4000);

    // 2. Establish Server-Sent Events stream
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      eventSource = new EventSource("/api/sse");

      eventSource.onopen = () => {
        setLiveConnected(true);
        setError(null);
        console.log("[SSE] Connected successfully.");
      };

      eventSource.onerror = (e) => {
        setLiveConnected(false);
        console.error("[SSE] Connection error. Attempting reconnect in 5s...");
        eventSource?.close();
        reconnectTimeout = setTimeout(connectSSE, 5000);
      };

      // Listen for NEW_LEAD events
      eventSource.addEventListener("NEW_LEAD", (event) => {
        console.log("[SSE] Received NEW_LEAD event:", event.data);
        fetchDashboardData(); // Hot reload the data
      });
    };

    connectSSE();

    return () => {
      clearInterval(pollingInterval);
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  // Compute aggregate stats
  const totalLeads = providers.reduce((sum, p) => sum + p.currentMonthLeads, 0);
  const totalQuota = providers.reduce((sum, p) => sum + p.monthlyQuota, 0);
  const avgUsagePercent = totalQuota > 0 ? Math.round((totalLeads / totalQuota) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col">
      {/* Background radial glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[140px]" />
      </div>

      <div className="max-w-7xl w-full mx-auto relative z-10 flex-1 flex flex-col">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-6 mb-8">
          <div>
            <div className="flex items-center space-x-3">
              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs px-2.5 py-1 rounded-md font-semibold tracking-wider uppercase">
                Enterprise
              </span>
              {liveConnected ? (
                <div className="flex items-center space-x-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Live Sync Connected</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-semibold text-red-400 uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span>Stream Offline</span>
                </div>
              )}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mt-2 text-white bg-clip-text text-transparent bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400">
              Provider Lead Distribution
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Real-time monitoring of round-robin allocations, provider workloads, and capacity caps.
            </p>
          </div>

          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <Link
              href="/request-service"
              className="bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl tracking-wide shadow-lg shadow-indigo-600/10 active:translate-y-px transition-all"
            >
              + Create Lead Request
            </Link>
            <Link
              href="/test-tools"
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl tracking-wide transition-all"
            >
              Testing Panel
            </Link>
          </div>
        </div>

        {/* Global Summary Stats Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5">
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
              Total Month Leads
            </div>
            <div className="text-3xl font-bold mt-1.5 text-white">{totalLeads}</div>
            <p className="text-[10px] text-slate-500 mt-1 uppercase">Across all providers</p>
          </div>
          <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5">
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
              System Quota Cap
            </div>
            <div className="text-3xl font-bold mt-1.5 text-white">{totalQuota}</div>
            <p className="text-[10px] text-slate-500 mt-1 uppercase">Monthly capacity limit</p>
          </div>
          <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5">
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
              Average Quota Usage
            </div>
            <div className="text-3xl font-bold mt-1.5 text-white">{avgUsagePercent}%</div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div 
                className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(avgUsagePercent, 100)}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Loading and Error States */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4" />
            <p className="text-slate-400 text-sm">Loading provider distribution details...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-2xl p-6 flex flex-col items-center justify-center text-center my-10">
            <svg className="w-8 h-8 text-red-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="font-bold text-white mb-1">Failed to Connect</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4">{error}</p>
            <button 
              onClick={fetchDashboardData}
              className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          /* Grid of 8 Providers */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {providers.map((provider) => {
              const remaining = provider.monthlyQuota - provider.currentMonthLeads;
              const percentUsed = Math.round((provider.currentMonthLeads / provider.monthlyQuota) * 100);
              
              return (
                <div 
                  key={provider.id} 
                  className="bg-slate-900/30 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col hover:shadow-indigo-500/5 transition-all group"
                >
                  {/* Provider Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-base text-white group-hover:text-indigo-400 transition-colors">
                        {provider.name}
                      </h3>
                      <p className="text-[10px] text-slate-500 uppercase font-medium mt-0.5">
                        Allocation Index: {provider.allocationIndex}
                      </p>
                    </div>
                    <span className="bg-slate-800 text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider">
                      Provider #{provider.id}
                    </span>
                  </div>

                  {/* Quota Progress */}
                  <div className="mb-4 bg-slate-950/40 border border-slate-800/60 rounded-xl p-3.5">
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-slate-400">Leads Received:</span>
                      <span className="font-bold text-white">{provider.currentMonthLeads} / {provider.monthlyQuota}</span>
                    </div>

                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          percentUsed >= 100 
                            ? "bg-red-500" 
                            : percentUsed >= 80 
                            ? "bg-amber-500" 
                            : "bg-indigo-500"
                        }`}
                        style={{ width: `${Math.min(percentUsed, 100)}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[9px] uppercase tracking-wider font-semibold">
                      <span className="text-slate-500">Remaining Quota:</span>
                      <span className={remaining <= 0 ? "text-red-400 font-bold" : "text-emerald-400"}>
                        {remaining} Left
                      </span>
                    </div>
                  </div>

                  {/* Assigned Leads List */}
                  <div className="flex-1 flex flex-col justify-start">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800/60 pb-1.5 mb-2">
                      Assigned Leads ({provider.assignments.length})
                    </h4>
                    
                    {provider.assignments.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center py-6">
                        <p className="text-[11px] text-slate-600 italic">No assigned leads this month</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                        {provider.assignments.map((assignment) => (
                          <div 
                            key={assignment.id} 
                            className="bg-slate-950/50 hover:bg-slate-950/80 border border-slate-800/50 p-2.5 rounded-lg text-xs transition-colors"
                          >
                            <div className="flex justify-between items-start font-semibold text-white mb-0.5">
                              <span className="truncate max-w-[120px]">{assignment.lead.customerName}</span>
                              <span className="bg-indigo-500/10 text-indigo-400 text-[8px] font-medium uppercase tracking-wider px-1 py-px rounded border border-indigo-500/20 max-w-[80px] truncate">
                                {assignment.lead.service.name}
                              </span>
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-400">
                              <span>{assignment.lead.city}</span>
                              <span className="text-[9px] text-slate-500">
                                {new Date(assignment.assignedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer timestamp */}
        {lastUpdated && (
          <div className="text-center text-[10px] text-slate-600 uppercase tracking-wider py-4 mt-auto">
            Last updated: {lastUpdated.toLocaleTimeString()} | Auto-connected to SSE Live Broadcast
          </div>
        )}
      </div>
    </div>
  );
}
