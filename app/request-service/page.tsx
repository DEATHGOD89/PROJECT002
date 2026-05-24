"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function RequestServicePage() {
  const [formData, setFormData] = useState({
    customerName: "",
    phone: "",
    city: "",
    serviceId: "1",
    description: "",
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignedProviders, setAssignedProviders] = useState<{ id: number; name: string }[]>([]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    setAssignedProviders([]);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit service request.");
      }

      setSuccess(true);
      setAssignedProviders(data.assignedProviders || []);
      
      // Reset form inputs but keep the selected service
      setFormData({
        customerName: "",
        phone: "",
        city: "",
        serviceId: formData.serviceId,
        description: "",
      });
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      {/* Background radial glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-lg z-10">
        {/* Navigation Breadcrumb */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold tracking-tight text-indigo-400">Prowider Mini</h1>
          <div className="flex space-x-4 text-sm">
            <Link href="/dashboard" className="text-slate-400 hover:text-indigo-400 transition-colors">
              Dashboard →
            </Link>
            <Link href="/test-tools" className="text-slate-400 hover:text-indigo-400 transition-colors">
              Test Tools
            </Link>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-slate-100 to-slate-300">
              Request a Service
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Submit your request to be automatically matched with the best providers.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="customerName" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Customer Name
              </label>
              <input
                id="customerName"
                type="text"
                name="customerName"
                required
                value={formData.customerName}
                onChange={handleChange}
                placeholder="John Doe"
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 019-2834"
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                />
              </div>

              <div>
                <label htmlFor="city" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  name="city"
                  required
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="San Francisco"
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="serviceId" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Requested Service
              </label>
              <select
                id="serviceId"
                name="serviceId"
                value={formData.serviceId}
                onChange={handleChange}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
              >
                <option value="1">Service 1</option>
                <option value="2">Service 2</option>
                <option value="3">Service 3</option>
              </select>
            </div>

            <div>
              <label htmlFor="description" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Project Description
              </label>
              <textarea
                id="description"
                name="description"
                required
                rows={3}
                value={formData.description}
                onChange={handleChange}
                placeholder="Tell us about the project details and requirements..."
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all resize-none"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3 flex items-start space-x-2">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl p-4 space-y-2">
                <div className="flex items-center space-x-2 font-semibold">
                  <svg className="w-4 h-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Request Created Successfully!</span>
                </div>
                <p className="text-slate-300">
                  Your lead has been assigned to the following service providers:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {assignedProviders.length > 0 ? (
                    assignedProviders.map((provider) => (
                      <span key={provider.id} className="bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider">
                        {provider.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-red-400 italic">No providers available or all out of quota.</span>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl py-3 text-sm font-semibold tracking-wide shadow-lg shadow-indigo-600/20 active:translate-y-px transition-all"
            >
              {loading ? "Allocating Providers..." : "Submit Request"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
