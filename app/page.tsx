'use client';

import { useState, useEffect, useMemo } from 'react';
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

// Toast notification component
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  
  return (
    <div className={`fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-xl shadow-lg z-50 animate-fadeInUp flex items-center gap-3`}>
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="hover:opacity-70">✕</button>
    </div>
  );
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
        <div className={`${color} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${(count / total) * 100}%` }}></div>
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  
  // Sorting state
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Bulk selection state
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  
  // Etsy connection state
  const [etsyStatus, setEtsyStatus] = useState<{
    connected: boolean;
    shopName?: string;
    lastSyncAt?: string;
    syncing?: boolean;
  }>({ connected: false });


  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let result = [...orders];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(o => 
        o.orderId.toLowerCase().includes(query) ||
        o.trackingNumber.toLowerCase().includes(query) ||
        (o.carrier && o.carrier.toLowerCase().includes(query))
      );
    }
    
    // Risk filter
    if (riskFilter !== 'all') {
      result = result.filter(o => o.riskLevel === riskFilter);
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(o => o.lastStatus === statusFilter);
    }
    
    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let cutoff: Date;
      switch (dateFilter) {
        case '7days': cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
        case '30days': cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        case '90days': cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
        default: cutoff = new Date(0);
      }
      result = result.filter(o => new Date(o.createdAt) >= cutoff);
    }

    
    // Sorting
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case 'orderId': aVal = a.orderId; bVal = b.orderId; break;
        case 'trackingNumber': aVal = a.trackingNumber; bVal = b.trackingNumber; break;
        case 'lastStatus': aVal = a.lastStatus || ''; bVal = b.lastStatus || ''; break;
        case 'riskLevel': 
          const riskOrder = { red: 3, yellow: 2, green: 1 };
          aVal = riskOrder[a.riskLevel as keyof typeof riskOrder] || 0;
          bVal = riskOrder[b.riskLevel as keyof typeof riskOrder] || 0;
          break;
        case 'lastUpdateAt': 
          aVal = a.lastUpdateAt ? new Date(a.lastUpdateAt).getTime() : 0;
          bVal = b.lastUpdateAt ? new Date(b.lastUpdateAt).getTime() : 0;
          break;
        default: 
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    return result;
  }, [orders, searchQuery, riskFilter, statusFilter, dateFilter, sortField, sortDirection]);


  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleSelectOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setToast({ message: 'Tracking number copied!', type: 'success' });
  };


  useEffect(() => {
    if (userId) {
      fetchOrders();
      fetchEtsyStatus();
      
      const params = new URLSearchParams(window.location.search);
      if (params.get('etsy_connected') === 'true') {
        const shopName = params.get('shop');
        setToast({ message: `Connected to Etsy shop: ${shopName}`, type: 'success' });
        window.history.replaceState({}, '', window.location.pathname);
        fetchEtsyStatus();
      } else if (params.get('etsy_error')) {
        setToast({ message: `Etsy connection failed: ${params.get('etsy_error')}`, type: 'error' });
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [userId]);

  const fetchOrders = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/orders`, {
        headers: { 'x-clerk-user-id': userId }
      });
      const data = await response.json();
      setOrders(data.orders || []);
      setError(null);
    } catch (err) {
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };


  const fetchEtsyStatus = async () => {
    if (!userId) return;
    try {
      const response = await fetch(`${API_URL}/api/etsy/status`, {
        headers: { 'x-clerk-user-id': userId }
      });
      const data = await response.json();
      setEtsyStatus({ ...data, syncing: false });
    } catch (err) {
      console.error('Failed to fetch Etsy status:', err);
    }
  };

  const connectEtsy = () => {
    if (!userId) return;
    window.location.href = `${API_URL}/api/etsy/auth?x-clerk-user-id=${userId}`;
  };

  const syncEtsy = async () => {
    if (!userId) return;
    setEtsyStatus(prev => ({ ...prev, syncing: true }));
    try {
      const response = await fetch(`${API_URL}/api/etsy/sync`, {
        method: 'POST',
        headers: { 'x-clerk-user-id': userId }
      });
      const data = await response.json();
      if (data.success) {
        setToast({ message: `Synced! ${data.imported} new orders imported`, type: 'success' });
        fetchOrders();
        fetchEtsyStatus();
      } else {
        setToast({ message: `Sync failed: ${data.error}`, type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Failed to sync orders', type: 'error' });
    } finally {
      setEtsyStatus(prev => ({ ...prev, syncing: false }));
    }
  };


  const disconnectEtsy = async () => {
    if (!userId) return;
    if (!confirm('Are you sure you want to disconnect your Etsy shop?')) return;
    try {
      await fetch(`${API_URL}/api/etsy/disconnect`, {
        method: 'POST',
        headers: { 'x-clerk-user-id': userId }
      });
      setEtsyStatus({ connected: false });
      setToast({ message: 'Etsy disconnected', type: 'info' });
    } catch (err) {
      setToast({ message: 'Failed to disconnect', type: 'error' });
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!userId) return;
    try {
      const response = await fetch(`${API_URL}/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: { 'x-clerk-user-id': userId }
      });
      if (response.ok) {
        setOrders(orders.filter(order => order.id !== orderId));
        setSelectedOrders(prev => { const n = new Set(prev); n.delete(orderId); return n; });
        setToast({ message: 'Order deleted', type: 'success' });
      } else {
        setToast({ message: 'Failed to delete order', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Failed to delete order', type: 'error' });
    }
  };


  const deleteSelectedOrders = async () => {
    if (!userId || selectedOrders.size === 0) return;
    if (!confirm(`Delete ${selectedOrders.size} selected orders?`)) return;
    
    let deleted = 0;
    for (const orderId of selectedOrders) {
      try {
        const response = await fetch(`${API_URL}/api/orders/${orderId}`, {
          method: 'DELETE',
          headers: { 'x-clerk-user-id': userId }
        });
        if (response.ok) deleted++;
      } catch (err) {}
    }
    
    setOrders(orders.filter(o => !selectedOrders.has(o.id)));
    setSelectedOrders(new Set());
    setToast({ message: `Deleted ${deleted} orders`, type: 'success' });
  };

  const checkTracking = async (orderId: string) => {
    if (!userId) return;
    try {
      const response = await fetch(`${API_URL}/api/orders/${orderId}/check`, {
        method: 'POST',
        headers: { 'x-clerk-user-id': userId }
      });
      const data = await response.json();
      setOrders(orders.map(order => order.id === orderId ? data.order : order));
      setToast({ message: 'Tracking updated', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to check tracking', type: 'error' });
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

  const getRiskLabel = (riskLevel: string | null | undefined): string => {
    if (!riskLevel) return 'Unknown';
    switch (riskLevel.toLowerCase()) {
      case 'green': return 'Healthy';
      case 'yellow': return 'Needs Attention';
      case 'red': return 'High Risk';
      default: return 'Unknown';
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

  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th 
      onClick={() => handleSort(field)}
      className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none"
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );


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
        body { font-family: 'Bricolage Grotesque', sans-serif; }
        h1, h2, h3, h4, h5, h6 { font-family: 'Syne', sans-serif; }
        .animate-fadeInUp { animation: fadeInUp 0.5s ease-out forwards; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
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
                {etsyStatus.connected ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-emerald-400 font-medium">🔗 {etsyStatus.shopName}</span>
                    <button onClick={syncEtsy} disabled={etsyStatus.syncing}
                      className="bg-orange-500 text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-orange-400 transition-all disabled:opacity-50">
                      {etsyStatus.syncing ? '⏳ Syncing...' : '🔄 Sync'}
                    </button>
                    <button onClick={disconnectEtsy} className="text-slate-400 hover:text-red-400 text-sm" title="Disconnect Etsy">✕</button>
                  </div>
                ) : (
                  <button onClick={connectEtsy} className="bg-orange-500 text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-orange-400 transition-all">
                    🔗 Connect Etsy
                  </button>
                )}
                <button onClick={() => setShowAddOrder(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold text-base hover:bg-blue-500 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-blue-500/50">
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
            <div className="bg-red-900/50 border-l-4 border-red-500 text-red-300 px-6 py-4 rounded-lg mb-6">
              <div className="flex items-center"><span className="text-2xl mr-3">⚠️</span><span className="font-semibold">{error}</span></div>
            </div>
          )}


          {/* Stats Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-4">
              <StatCard label="Total Orders" value={orders.length} icon="📦" color="from-blue-500 to-sky-600" />
              <StatCard label="At Risk" value={orders.filter(o => o.riskLevel === 'red' || o.riskLevel === 'yellow').length} icon="⚠️" color="from-amber-500 to-yellow-600" />
              <StatCard label="In Transit" value={orders.filter(o => o.lastStatus === 'in_transit').length} icon="🚚" color="from-indigo-500 to-purple-600" />
              <StatCard label="Delivered" value={orders.filter(o => o.lastStatus === 'delivered').length} icon="✅" color="from-emerald-500 to-green-600" />
            </div>
            <div className="lg:col-span-2">
              <DeliveryRiskOverview orders={orders} />
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-slate-800/50 rounded-2xl p-4 mb-6 border border-slate-700">
            <div className="flex flex-wrap gap-4 items-center">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search orders, tracking numbers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <svg className="absolute left-3 top-2.5 w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              
              {/* Risk Filter */}
              <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}
                className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500">
                <option value="all">All Risks</option>
                <option value="green">Healthy</option>
                <option value="yellow">Needs Attention</option>
                <option value="red">High Risk</option>
              </select>
              
              {/* Status Filter */}
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500">
                <option value="all">All Statuses</option>
                <option value="pre_transit">Pre-Transit</option>
                <option value="in_transit">In Transit</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="exception">Exception</option>
                <option value="delivery_failed">Failed</option>
              </select>
              
              {/* Date Filter */}
              <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500">
                <option value="all">All Time</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
              </select>
              
              {/* Bulk Delete */}
              {selectedOrders.size > 0 && (
                <button onClick={deleteSelectedOrders}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all">
                  🗑️ Delete ({selectedOrders.size})
                </button>
              )}
            </div>
            
            {/* Filter summary */}
            {(searchQuery || riskFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all') && (
              <div className="mt-3 text-sm text-slate-400">
                Showing {filteredOrders.length} of {orders.length} orders
                <button onClick={() => { setSearchQuery(''); setRiskFilter('all'); setStatusFilter('all'); setDateFilter('all'); }}
                  className="ml-2 text-blue-400 hover:text-blue-300">Clear filters</button>
              </div>
            )}
          </div>


          {/* Orders Table */}
          {orders.length === 0 ? (
            <div className="bg-slate-800/50 rounded-2xl shadow-xl p-16 text-center border-2 border-slate-700">
              <div className="text-6xl mb-6">📭</div>
              <h3 className="text-2xl font-bold text-white mb-3">No orders yet</h3>
              <p className="text-slate-400 text-lg mb-6 max-w-md mx-auto">Add your first order to start tracking deliveries</p>
              <button onClick={() => setShowAddOrder(true)}
                className="bg-blue-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-blue-500 transform hover:scale-105 transition-all shadow-lg">
                Add Your First Order
              </button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-slate-800/50 rounded-2xl shadow-xl p-16 text-center border-2 border-slate-700">
              <div className="text-6xl mb-6">🔍</div>
              <h3 className="text-2xl font-bold text-white mb-3">No orders match your filters</h3>
              <p className="text-slate-400 text-lg mb-6">Try adjusting your search or filters</p>
              <button onClick={() => { setSearchQuery(''); setRiskFilter('all'); setStatusFilter('all'); setDateFilter('all'); }}
                className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold hover:bg-blue-500 transition-all">
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-2xl shadow-xl overflow-hidden border-2 border-slate-700">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-slate-900">
                    <tr>
                      <th className="px-4 py-4 text-left">
                        <input type="checkbox" checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500" />
                      </th>
                      <SortHeader field="orderId">Order</SortHeader>
                      <SortHeader field="trackingNumber">Tracking</SortHeader>
                      <SortHeader field="lastStatus">Status</SortHeader>
                      <SortHeader field="riskLevel">Risk</SortHeader>
                      <SortHeader field="lastUpdateAt">Last Update</SortHeader>
                      <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-700">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className={`hover:bg-slate-700/50 transition-colors ${selectedOrders.has(order.id) ? 'bg-blue-900/20' : ''}`}>
                        <td className="px-4 py-4">
                          <input type="checkbox" checked={selectedOrders.has(order.id)}
                            onChange={() => toggleSelectOrder(order.id)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500" />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-bold text-white text-base">{order.orderId}</div>
                          <div className="text-sm text-slate-400 font-medium">{order.carrier || 'Unknown carrier'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-300 font-mono font-semibold">{order.trackingNumber}</span>
                            <button onClick={() => copyToClipboard(order.trackingNumber)}
                              className="p-1 hover:bg-slate-700 rounded transition-colors" title="Copy tracking number">
                              <svg className="w-4 h-4 text-slate-500 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {order.lastStatus ? getStatusBadge(order.lastStatus) : <span className="text-slate-500">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {order.riskLevel ? (
                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getRiskColor(order.riskLevel)}`}>
                              {getRiskLabel(order.riskLevel)}
                            </span>
                          ) : <span className="text-slate-500">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                          {order.lastUpdateAt ? new Date(order.lastUpdateAt).toLocaleString() : 'Never'}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold space-x-2">
                          <button onClick={() => checkTracking(order.id)}
                            className="text-blue-400 hover:text-blue-300 hover:underline font-bold">
                            Check
                          </button>
                          <button onClick={() => deleteOrder(order.id)}
                            className="group p-1.5 rounded-lg hover:bg-red-500/20 transition-all inline-block" title="Delete order">
                            <svg className="w-5 h-5 text-slate-400 group-hover:text-red-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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

        {showAddOrder && userId && (
          <AddOrderModal userId={userId} onClose={() => setShowAddOrder(false)}
            onSuccess={() => { setShowAddOrder(false); fetchOrders(); setToast({ message: 'Order added!', type: 'success' }); }} />
        )}
      </div>
    </>
  );
}


function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-2xl shadow-lg p-5 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl border border-white/10`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-2xl">{icon}</div>
        <div className="text-3xl font-black text-white">{value}</div>
      </div>
      <div className="text-xs font-bold text-white/80 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function AddOrderModal({ userId, onClose, onSuccess }: { userId: string; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({ orderId: '', trackingNumber: '', carrier: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-clerk-user-id': userId },
        body: JSON.stringify(formData)
      });
      if (!response.ok) throw new Error('Failed to create order');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeInUp">
      <div className="bg-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-8 border border-slate-700">
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
            <label className="block text-sm font-bold text-slate-300 mb-2">Etsy Order ID *</label>
            <input type="text" required value={formData.orderId}
              onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
              className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 text-white rounded-xl focus:ring-4 focus:ring-blue-500/50 focus:border-blue-500 font-medium"
              placeholder="e.g., 1234567890" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Tracking Number *</label>
            <input type="text" required value={formData.trackingNumber}
              onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
              className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 text-white rounded-xl focus:ring-4 focus:ring-blue-500/50 focus:border-blue-500 font-mono"
              placeholder="e.g., 1Z999AA10123456784" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Carrier (optional)</label>
            <select value={formData.carrier} onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
              className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 text-white rounded-xl focus:ring-4 focus:ring-blue-500/50 focus:border-blue-500">
              <option value="">Auto-detect</option>
              <option value="USPS">USPS</option>
              <option value="UPS">UPS</option>
              <option value="FedEx">FedEx</option>
              <option value="DHL">DHL</option>
            </select>
          </div>
          <div className="flex space-x-4 pt-4">
            <button type="button" onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-slate-700 rounded-xl text-slate-300 font-bold hover:bg-slate-700 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 disabled:opacity-50 transition-all transform hover:scale-105 shadow-lg hover:shadow-blue-500/50">
              {loading ? 'Adding...' : 'Add Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
