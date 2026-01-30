'use client';

import { useState, useEffect } from 'react';
import { UserButton, useUser, useAuth } from '@clerk/nextjs';

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

function DeliveryRiskOverview({ orders }: { orders: Order[] }) {
  const healthyCount = orders.filter(o => o.riskLevel === 'green').length;
  const attentionCount = orders.filter(o => o.riskLevel === 'yellow').length;
  const highRiskCount = orders.filter(o => o.riskLevel === 'red').length;
  const total = orders.length || 1;

  const atRiskOrders = orders
    .filter(o => o.riskLevel === 'yellow' || o.riskLevel === 'red')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  const ProgressBar = ({ label, count, total, color }: { label: string, count: number, total: number, color: string }) => (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-bold text-slate-300">{label}</span>
        <span className="text-sm font-bold text-white">{count}</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2.5">
        <div className={`${color} h-2.5 rounded-full`} style={{ width: `${(count / total) * 100}%` }}></div>
      </div>
    </div>
  );

  return (
    <div className="bg-slate-800/50 rounded-2xl shadow-xl p-6 border-2 border-slate-700 backdrop-blur-sm h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white">Delivery Risk Overview</h3>
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
      </div>
      <div className="space-y-4 mb-6">
        <ProgressBar label="Healthy" count={healthyCount} total={total} color="bg-gradient-to-r from-emerald-500 to-green-600" />
        <ProgressBar label="Needs attention" count={attentionCount} total={total} color="bg-gradient-to-r from-amber-500 to-yellow-600" />
        <ProgressBar label="High risk" count={highRiskCount} total={total} color="bg-gradient-to-r from-red-500 to-rose-600" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-slate-300 mb-3">Recent At-Risk Orders</h4>
        <div className="space-y-3">
          {atRiskOrders.length > 0 ? atRiskOrders.map(order => (
            <div key={order.id} className="flex items-center p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
              <span className={`h-3 w-3 rounded-full mr-3 ${order.riskLevel === 'red' ? 'bg-red-500' : 'bg-amber-400'}`}></span>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{order.orderId}</p>
                <p className="text-xs text-slate-400">{order.lastStatus || 'Unknown'}</p>
              </div>
              <span className={`text-xs font-bold ${order.riskLevel === 'red' ? 'text-red-400' : 'text-amber-300'}`}>
                {order.riskLevel === 'red' ? 'Urgent' : 'Follow up'}
              </span>
            </div>
          )) : (
            <p className="text-sm text-slate-400">No at-risk orders right now. Great job!</p>
          )}
        </div>
      </div>
    </div>
  );
}


export default function DashboardPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { userId } = useAuth();

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
    if (userId) {
      fetchOrders();
    }
  }, [userId]);

  const fetchOrders = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/orders`, {
        headers: {
          'x-clerk-user-id': userId
        }
      });
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

  const deleteOrder = async (orderId: string) => {
    if (!userId) return;
    if (!confirm('Are you sure you want to delete this order?')) return;

    try {
      const response = await fetch(`${API_URL}/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'x-clerk-user-id': userId
        }
      });

      if (response.ok) {
        setOrders(orders.filter(order => order.id !== orderId));
      } else {
        alert('Failed to delete order');
      }
    } catch (err) {
      alert('Failed to delete order');
      console.error(err);
    }
  };

  const checkTracking = async (orderId: string) => {
    if (!userId) return;
    try {
      const response = await fetch(`${API_URL}/api/orders/${orderId}/check`, {
        method: 'POST',
        headers: {
          'x-clerk-user-id': userId
        }
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
    if (!riskLevel) return 'bg-gray-700 text-gray-300';
    
    switch (riskLevel.toLowerCase()) {
      case 'green': return 'bg-emerald-500 text-white';
      case 'yellow': return 'bg-amber-400 text-gray-900';
      case 'red': return 'bg-red-500 text-white';
      default: return 'bg-gray-700 text-gray-300';
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
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
        .animate-fadeInUp {
          animation: fadeInUp 0.5s ease-out forwards;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        {/* Header */}
        <header className="bg-slate-900/50 backdrop-blur-lg border-b border-slate-700 shadow-xl sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">OrderWarden</h1>
                <p className="text-slate-400 text-sm font-medium mt-1">Protecting your Etsy shop</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowAddOrder(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold text-base hover:bg-blue-500 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-blue-500/50"
                >
                  + Add Order
                </button>
                <div className="bg-slate-700 rounded-full p-1 shadow-lg">
                  <UserButton afterSignOutUrl="https://landing.orderwarden.com" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeInUp">
          {error && (
            <div className="bg-red-900/50 border-l-4 border-red-500 text-red-300 px-6 py-4 rounded-lg mb-6 shadow-md backdrop-blur-sm">
              <div className="flex items-center">
                <span className="text-2xl mr-3">⚠️</span>
                <span className="font-semibold">{error}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6">
                <StatCard
                  label="Total Orders"
                  value={orders.length}
                  icon="📦"
                  color="from-blue-500 to-sky-600"
                />
                <StatCard
                  label="At Risk"
                  value={orders.filter(o => o.riskLevel === 'red' || o.riskLevel === 'yellow').length}
                  icon="⚠️"
                  color="from-amber-500 to-yellow-600"
                />
                <StatCard
                  label="In Transit"
                  value={orders.filter(o => o.lastStatus === 'in_transit').length}
                  icon="🚚"
                  color="from-indigo-500 to-purple-600"
                />
                <StatCard
                  label="Delivered"
                  value={orders.filter(o => o.lastStatus === 'delivered').length}
                  icon="✅"
                  color="from-emerald-500 to-green-600"
                />
            </div>
            <div className="lg:col-span-2">
                <DeliveryRiskOverview orders={orders} />
            </div>
          </div>

          {/* Orders Table */}
          {orders.length === 0 ? (
            <div className="bg-slate-800/50 rounded-2xl shadow-xl p-16 text-center border-2 border-slate-700 backdrop-blur-sm">
              <div className="text-6xl mb-6">📭</div>
              <h3 className="text-2xl font-bold text-white mb-3">No orders yet</h3>
              <p className="text-slate-400 text-lg mb-6 max-w-md mx-auto">
                Add your first order to start tracking deliveries and preventing refunds
              </p>
              <button
                onClick={() => setShowAddOrder(true)}
                className="bg-blue-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-blue-500 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-blue-500/50"
              >
                Add Your First Order
              </button>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-2xl shadow-xl overflow-hidden border-2 border-slate-700 backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-slate-900">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Order</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Tracking</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Risk</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Last Update</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-700/50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-bold text-white text-base">{order.orderId}</div>
                          <div className="text-sm text-slate-400 font-medium">{order.carrier || 'Unknown carrier'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-300 font-mono font-semibold">{order.trackingNumber}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {order.lastStatus ? getStatusBadge(order.lastStatus) : <span className="text-slate-500 font-medium">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {order.riskLevel ? (
                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getRiskColor(order.riskLevel)}`}>
                              {order.riskLevel}
                            </span>
                          ) : <span className="text-slate-500 font-medium">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 font-medium">
                          {order.lastUpdateAt ? new Date(order.lastUpdateAt).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold space-x-4">
                          <button
                            onClick={() => checkTracking(order.id)}
                            className="text-blue-400 hover:text-blue-300 hover:underline font-bold"
                          >
                            Check Tracking
                          </button>
                          <button
                            onClick={() => deleteOrder(order.id)}
                            className="group p-1.5 rounded-lg hover:bg-red-500/20 transition-all duration-200"
                            title="Delete order"
                          >
                            <svg
                              className="w-5 h-5 text-slate-400 group-hover:text-red-400 transition-colors duration-200"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1.5}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
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
        {showAddOrder && userId && (
          <AddOrderModal
            userId={userId}
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
    <div className={`bg-gradient-to-br ${color} rounded-2xl shadow-lg p-6 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl backdrop-blur-sm border border-white/10`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-3xl">{icon}</div>
        <div className={`text-4xl font-black text-white`}>{value}</div>
      </div>
      <div className="text-sm font-bold text-white/80 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function AddOrderModal({ userId, onClose, onSuccess }: { userId: string; onClose: () => void; onSuccess: () => void }) {
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
        headers: {
          'Content-Type': 'application/json',
          'x-clerk-user-id': userId
        },
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeInUp">
      <div className="bg-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-8 transform border border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-black text-white">Add New Order</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border-l-4 border-red-500 text-red-300 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">
              Etsy Order ID *
            </label>
            <input
              type="text"
              required
              value={formData.orderId}
              onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
              className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 text-white rounded-xl focus:ring-4 focus:ring-blue-500/50 focus:border-blue-500 font-medium transition-all"
              placeholder="e.g., 1234567890"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">
              Tracking Number *
            </label>
            <input
              type="text"
              required
              value={formData.trackingNumber}
              onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
              className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 text-white rounded-xl focus:ring-4 focus:ring-blue-500/50 focus:border-blue-500 font-mono font-medium transition-all"
              placeholder="e.g., 1Z999AA10123456784"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">
              Carrier (optional)
            </label>
            <select
              value={formData.carrier}
              onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
              className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 text-white rounded-xl focus:ring-4 focus:ring-blue-500/50 focus:border-blue-500 font-medium transition-all"
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
              className="flex-1 px-6 py-3 border-2 border-slate-700 rounded-xl text-slate-300 font-bold hover:bg-slate-700 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg hover:shadow-blue-500/50"
            >
              {loading ? 'Adding...' : 'Add Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
