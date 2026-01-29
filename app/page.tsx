'use client';

import { useState, useEffect } from 'react';
import { UserButton, useUser } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Order {
  id: string;
  orderId: string;
  trackingNumber: string;
  carrier: string | null;
  lastStatus: string | null;
  lastUpdateAt: string | null;
  riskLevel: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      window.location.href = 'https://landing.orderwarden.com';
    }
  }, [isLoaded, isSignedIn]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddOrder, setShowAddOrder] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/orders`);
      const data = await response.json();
      setOrders(data.orders || []);
      setError(null);
    } catch (err) {
      setError('Failed to load orders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkTracking = async (orderId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/orders/${orderId}/check`, {
        method: 'POST'
      });
      const data = await response.json();
      
      setOrders(orders.map(order => 
        order.id === orderId ? data.order : order
      ));
      
      if (data.recommendedMessage) {
        alert(`Recommended Message:\n\n${data.recommendedMessage.message}`);
      }
    } catch (err) {
      alert('Failed to check tracking');
      console.error(err);
    }
  };

  const getRiskColor = (riskLevel: string | null | undefined): string => {
    if (!riskLevel) return 'bg-gray-100 text-gray-700';
    
    switch (riskLevel.toLowerCase()) {
      case 'green': return 'bg-emerald-500 text-white';
      case 'yellow': return 'bg-amber-400 text-gray-900';
      case 'red': return 'bg-red-500 text-white';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusBadge = (status: string | null) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      'pre_transit': { label: 'Pre-Transit', color: 'bg-blue-500 text-white' },
      'in_transit': { label: 'In Transit', color: 'bg-blue-500 text-white' },
      'out_for_delivery': { label: 'Out for Delivery', color: 'bg-emerald-500 text-white' },
      'delivered': { label: 'Delivered', color: 'bg-emerald-500 text-white' },
      'exception': { label: 'Exception', color: 'bg-red-500 text-white' },
      'delivery_failed': { label: 'Failed', color: 'bg-red-500 text-white' },
      'unknown': { label: 'Unknown', color: 'bg-gray-500 text-white' }
    };
    
    const info = statusMap[status || 'unknown'] || statusMap['unknown'];
    return <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${info.color}`}>{info.label}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-400 border-t-transparent mx-auto mb-4"></div>
          <p className="text-white text-xl font-bold">Loading your orders...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Bricolage+Grotesque:wght@400;500;600;700&display=swap');
        
        body {
          font-family: 'Bricolage Grotesque', sans-serif;
        }
        
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Syne', sans-serif;
        }
      `}</style>
      
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-gradient-to-r from-red-600 to-red-700 border-b-4 border-red-800 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight">OrderWarden</h1>
                <p className="text-red-100 text-sm font-medium mt-1">Protecting your Etsy shop</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowAddOrder(true)}
                  className="bg-yellow-400 text-gray-900 px-6 py-3 rounded-full font-bold text-base hover:bg-yellow-300 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  + Add Order
                </button>
                <div className="bg-white rounded-full p-1 shadow-lg">
                  <UserButton afterSignOutUrl="https://landing.orderwarden.com" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-800 px-6 py-4 rounded-lg mb-6 shadow-md">
              <div className="flex items-center">
                <span className="text-2xl mr-3">⚠️</span>
                <span className="font-semibold">{error}</span>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <StatCard
              label="Total Orders"
              value={orders.length}
              icon="📦"
              color="from-blue-500 to-blue-600"
            />
            <StatCard
              label="At Risk"
              value={orders.filter(o => o.riskLevel === 'red' || o.riskLevel === 'yellow').length}
              icon="⚠️"
              color="from-yellow-400 to-yellow-500"
            />
            <StatCard
              label="In Transit"
              value={orders.filter(o => o.lastStatus === 'in_transit').length}
              icon="🚚"
              color="from-blue-500 to-blue-600"
            />
            <StatCard
              label="Delivered"
              value={orders.filter(o => o.lastStatus === 'delivered').length}
              icon="✅"
              color="from-emerald-500 to-emerald-600"
            />
          </div>

          {/* Orders Table */}
          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl p-16 text-center border-2 border-gray-100">
              <div className="text-6xl mb-6">📭</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">No orders yet</h3>
              <p className="text-gray-600 text-lg mb-6 max-w-md mx-auto">
                Add your first order to start tracking deliveries and preventing refunds
              </p>
              <button
                onClick={() => setShowAddOrder(true)}
                className="bg-gradient-to-r from-red-600 to-red-700 text-white px-8 py-4 rounded-full font-bold text-lg hover:from-red-700 hover:to-red-800 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-2xl"
              >
                Add Your First Order
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gray-100">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gradient-to-r from-gray-800 to-gray-900">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Order</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Tracking</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Risk</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Last Update</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-white uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-red-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-bold text-gray-900 text-base">{order.orderId}</div>
                          <div className="text-sm text-gray-500 font-medium">{order.carrier || 'Unknown carrier'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-mono font-semibold">{order.trackingNumber}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {order.lastStatus ? getStatusBadge(order.lastStatus) : <span className="text-gray-400 font-medium">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {order.riskLevel ? (
                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getRiskColor(order.riskLevel)}`}>
                              {order.riskLevel}
                            </span>
                          ) : <span className="text-gray-400 font-medium">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                          {order.lastUpdateAt ? new Date(order.lastUpdateAt).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold">
                          <button
                            onClick={() => checkTracking(order.id)}
                            className="text-red-600 hover:text-red-800 hover:underline font-bold"
                          >
                            Check Tracking →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* Add Order Modal */}
        {showAddOrder && (
          <AddOrderModal
            onClose={() => setShowAddOrder(false)}
            onSuccess={() => {
              setShowAddOrder(false);
              fetchOrders();
            }}
          />
        )}
      </div>
    </>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-2xl shadow-lg p-6 transform hover:scale-105 transition-all duration-200 hover:shadow-2xl`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-3xl">{icon}</div>
        <div className={`text-4xl font-black text-white`}>{value}</div>
      </div>
      <div className="text-sm font-bold text-white opacity-90 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function AddOrderModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    orderId: '',
    trackingNumber: '',
    carrier: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to create order');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 transform animate-scale-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-black text-gray-900">Add New Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-800 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Etsy Order ID *
            </label>
            <input
              type="text"
              required
              value={formData.orderId}
              onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-red-200 focus:border-red-500 font-medium transition-all"
              placeholder="e.g., 1234567890"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Tracking Number *
            </label>
            <input
              type="text"
              required
              value={formData.trackingNumber}
              onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-red-200 focus:border-red-500 font-mono font-medium transition-all"
              placeholder="e.g., 1Z999AA10123456784"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Carrier (optional)
            </label>
            <select
              value={formData.carrier}
              onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-red-200 focus:border-red-500 font-medium transition-all"
            >
              <option value="">Auto-detect</option>
              <option value="USPS">USPS</option>
              <option value="UPS">UPS</option>
              <option value="FedEx">FedEx</option>
              <option value="DHL">DHL</option>
            </select>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-bold hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              {loading ? 'Adding...' : 'Add Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
