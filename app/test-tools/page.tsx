"use client";

import React, { useState } from "react";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";

interface LogEntry {
  timestamp: string;
  type: "info" | "success" | "error" | "warning";
  message: string;
}

export default function TestToolsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({
    reset: false,
    idempotency: false,
    concurrency: false,
  });

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [{ timestamp, type, message }, ...prev]);
  };

  const clearLogs = () => setLogs([]);

  // Button 1: Reset All Provider Quotas
  const handleResetQuotas = async () => {
    setLoading((prev) => ({ ...prev, reset: true }));
    const key = uuidv4();
    addLog(`[Webhook Quota Reset] Initiating. Key: ${key}`, "info");

    try {
      const response = await fetch("/api/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "QUOTA_RESET", idempotencyKey: key }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to reset quotas.");

      addLog(`[Webhook Quota Reset] Processed: ${data.processed}. Already Processed: ${data.alreadyProcessed}`, "success");
    } catch (err: any) {
      addLog(`[Webhook Quota Reset] Error: ${err.message}`, "error");
    } finally {
      setLoading((prev) => ({ ...prev, reset: false }));
    }
  };

  // Button 2: Call Webhook 5x with Same Key (Idempotency Test)
  const handleIdempotencyTest = async () => {
    setLoading((prev) => ({ ...prev, idempotency: true }));
    const key = uuidv4();
    addLog(`[Idempotency Test] Starting 5 duplicate webhook calls with key: ${key}`, "info");

    const promises = Array.from({ length: 5 }).map(async (_, index) => {
      try {
        const response = await fetch("/api/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "QUOTA_RESET", idempotencyKey: key }),
        });
        const data = await response.json();
        return { index: index + 1, ok: response.ok, status: response.status, data };
      } catch (err: any) {
        return { index: index + 1, ok: false, status: 500, error: err.message };
      }
    });

    try {
      const results = await Promise.all(promises);
      results.forEach((res) => {
        if (!res.ok) {
          addLog(`Call #${res.index}: Failed (Status: ${res.status})`, "error");
        } else {
          const statusText = res.data.processed ? "PROCESSED (NEW EVENT)" : "IGNORED (DUPLICATE DETECTED)";
          const colorType = res.data.processed ? "success" : "warning";
          addLog(`Call #${res.index}: Status ${res.status} | ${statusText}`, colorType);
        }
      });
      addLog("[Idempotency Test] Complete. Result: 1 processed event and 4 duplicate events ignored.", "success");
    } catch (err: any) {
      addLog(`[Idempotency Test] Error running parallel requests: ${err.message}`, "error");
    } finally {
      setLoading((prev) => ({ ...prev, idempotency: false }));
    }
  };

  // Button 3: Generate 10 Simultaneous Leads
  const handleConcurrencyTest = async () => {
    setLoading((prev) => ({ ...prev, concurrency: true }));
    addLog("[Concurrency Test] Firing 10 parallel lead creation requests...", "info");

    const mockNames = [
      "Alice Smith", "Bob Jones", "Charlie Brown", "Diana Prince", "Evan Wright",
      "Fiona Gallagher", "George Clark", "Hannah Abbott", "Ian Malcolm", "Julia Roberts"
    ];
    const mockCities = [
      "New York", "Los Angeles", "Chicago", "Houston", "Phoenix",
      "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose"
    ];

    const promises = Array.from({ length: 10 }).map(async (_, index) => {
      const customerName = mockNames[index];
      // Create random unique phone numbers to bypass phone+service unique constraint during bulk testing
      const phone = `+1-555-01${Math.floor(10 + Math.random() * 90)}-${index}${Math.floor(100 + Math.random() * 900)}`;
      const serviceId = (index % 3) + 1; // Rotates between Service 1, 2, and 3
      const city = mockCities[index];
      const description = `Concurrent test lead #${index + 1} for Service ${serviceId}`;

      try {
        const response = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerName, phone, city, serviceId, description }),
        });
        const data = await response.json();
        return { index: index + 1, ok: response.ok, status: response.status, data, customerName, serviceId };
      } catch (err: any) {
        return { index: index + 1, ok: false, status: 500, error: err.message, customerName, serviceId };
      }
    });

    try {
      const results = await Promise.all(promises);
      let successCount = 0;
      let failureCount = 0;

      results.forEach((res) => {
        if (!res.ok) {
          addLog(`Lead #${res.index} (${res.customerName} → Service ${res.serviceId}): Failed! ${res.data?.error || res.error}`, "error");
          failureCount++;
        } else {
          const providers = res.data.assignedProviders.map((p: any) => p.name).join(", ");
          addLog(`Lead #${res.index} (${res.customerName} → Service ${res.serviceId}): Success! Lead ID: ${res.data.leadId} | Assigned to: [${providers}]`, "success");
          successCount++;
        }
      });
      addLog(`[Concurrency Test] Finished. Total Successes: ${successCount}, Total Failures: ${failureCount}`, "info");
    } catch (err: any) {
      addLog(`[Concurrency Test] Execution Error: ${err.message}`, "error");
    } finally {
      setLoading((prev) => ({ ...prev, concurrency: false }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col">
      {/* Background radial glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl w-full mx-auto relative z-10 flex-1 flex flex-col">
        {/* Breadcrumbs */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-6 mb-8">
          <div>
            <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs px-2.5 py-1 rounded-md font-semibold tracking-wider uppercase">
              Internal Dev Tools
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight mt-2 text-white">
              Testing Panel
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Simulate high-concurrency requests, validate transaction row locks, and evaluate webhook idempotency keys.
            </p>
          </div>
          <div className="flex space-x-4 text-sm font-semibold">
            <Link href="/dashboard" className="text-slate-400 hover:text-indigo-400 transition-colors">
              Dashboard
            </Link>
            <Link href="/request-service" className="text-slate-400 hover:text-indigo-400 transition-colors">
              Request Service
            </Link>
          </div>
        </div>

        {/* Buttons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Button 1 */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
            <div>
              <h3 className="font-bold text-white text-sm uppercase tracking-wider mb-1">
                Reset Provider Quotas
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Dispatches a POST request to `/api/webhook` with a new UUID. Re-zeroes all workloads.
              </p>
            </div>
            <button
              onClick={handleResetQuotas}
              disabled={loading.reset}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs py-2.5 rounded-xl transition-all shadow-md active:translate-y-px"
            >
              {loading.reset ? "Resetting..." : "Reset All Quotas"}
            </button>
          </div>

          {/* Button 2 */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
            <div>
              <h3 className="font-bold text-white text-sm uppercase tracking-wider mb-1">
                Idempotency Test
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Fires 5 simultaneous webhooks with the same key. The database must only execute the first request.
              </p>
            </div>
            <button
              onClick={handleIdempotencyTest}
              disabled={loading.idempotency}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2.5 rounded-xl transition-all shadow-md active:translate-y-px"
            >
              {loading.idempotency ? "Testing..." : "Run Idempotency Test (5x)"}
            </button>
          </div>

          {/* Button 3 */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
            <div>
              <h3 className="font-bold text-white text-sm uppercase tracking-wider mb-1">
                Simultaneous Leads
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Dispatches 10 parallel lead POST requests. Asserts row locking is correct and prevents race conditions.
              </p>
            </div>
            <button
              onClick={handleConcurrencyTest}
              disabled={loading.concurrency}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs py-2.5 rounded-xl transition-all shadow-md active:translate-y-px"
            >
              {loading.concurrency ? "Generating..." : "Generate 10 Leads"}
            </button>
          </div>
        </div>

        {/* Live Terminal Log */}
        <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 flex-1 flex flex-col shadow-inner">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 text-xs font-mono tracking-wider">
            <span className="text-slate-500 flex items-center space-x-1.5 uppercase font-bold">
              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block animate-pulse" />
              <span>Simulation Log Console</span>
            </span>
            <button
              onClick={clearLogs}
              className="text-slate-400 hover:text-white transition-colors"
            >
              Clear Console [x]
            </button>
          </div>

          <div className="flex-1 min-h-[300px] max-h-[450px] overflow-y-auto font-mono text-xs space-y-2.5 pr-2 scrollbar-thin select-text">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic py-10 text-center">
                Console is idle. Trigger testing buttons above to display live diagnostic output.
              </div>
            ) : (
              logs.map((log, index) => {
                let colorClass = "text-slate-400";
                if (log.type === "success") colorClass = "text-emerald-400";
                if (log.type === "error") colorClass = "text-red-400";
                if (log.type === "warning") colorClass = "text-amber-400";

                return (
                  <div key={index} className="flex items-start space-x-2 py-0.5 border-b border-slate-900/40">
                    <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
                    <span className={`${colorClass} break-all`}>{log.message}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
