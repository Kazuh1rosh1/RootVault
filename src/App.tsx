/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Lock, 
  Unlock, 
  ShieldCheck, 
  Search, 
  Plus, 
  Eye, 
  EyeOff, 
  Copy, 
  Trash2, 
  Settings, 
  LogOut,
  ChevronRight,
  ShieldAlert,
  Save,
  X,
  CreditCard,
  User,
  Globe,
  RefreshCw,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Menu,
  Infinity,
  Fingerprint,
  Table,
  FileJson
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { 
  deriveKey, 
  encryptVault, 
  decryptVault, 
  VaultEntry, 
  generatePassword,
  generateId
} from './services/crypto';
import { 
  isBiometricSupported, 
  registerBiometric, 
  verifyBiometric, 
  clearBiometric 
} from './services/biometrics';

// --- Types ---
type AppState = 'LOCKED' | 'SETUP' | 'UNLOCKED';

// --- Constants ---
const VAULT_STORAGE_KEY = 'rootvault_vault_data';
const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 minutes 

type NavView = 'VAULT' | 'FAVORITES' | 'SECURITY' | 'SETTINGS';

export default function App() {
  const [state, setState] = useState<AppState>('LOCKED');
  const [navView, setNavView] = useState<NavView>('VAULT');
  const [password, setPassword] = useState('');
  const [masterKey, setMasterKey] = useState<string | null>(null);
  const [vault, setVault] = useState<VaultEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [genLength, setGenLength] = useState(16);
  const [genOptions, setGenOptions] = useState({ numbers: true, symbols: true });
  const [autoLockMinutes, setAutoLockMinutes] = useState(3);
  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const csvInputRef = React.useRef<HTMLInputElement>(null);
  const passkeyInputRef = React.useRef<HTMLInputElement>(null);

  // New Entry Form State
  const [newEntry, setNewEntry] = useState<Partial<VaultEntry>>({
    service: '',
    username: '',
    password: '',
    category: 'Login',
    notes: ''
  });

  // Check if vault exists on mount
  useEffect(() => {
    const existingVault = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!existingVault) {
      setState('SETUP');
    }
  }, []);

  // Check biometric support
  useEffect(() => {
    isBiometricSupported().then(supported => setBioSupported(supported));
    setBioEnabled(!!localStorage.getItem('rootvault_bio_data'));
  }, [state]);

  // Auto-focus passkey input
  useEffect(() => {
    if ((state === 'SETUP' || state === 'LOCKED') && passkeyInputRef.current) {
      setTimeout(() => passkeyInputRef.current?.focus(), 100);
    }
  }, [state]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Actions ---
  const handleSetup = () => {
    if (password.length < 8) {
      setError('Master password must be at least 8 characters');
      return;
    }
    const key = deriveKey(password);
    setMasterKey(key);
    const initialVault: VaultEntry[] = [];
    const encrypted = encryptVault(initialVault, key);
    localStorage.setItem(VAULT_STORAGE_KEY, encrypted);
    setVault(initialVault);
    setState('UNLOCKED');
    setPassword('');
    setError(null);
    showToast('Vault created successfully');
  };

  const handleUnlock = () => {
    const encrypted = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!encrypted) return;

    try {
      const key = deriveKey(password);
      const decrypted = decryptVault(encrypted, key);
      setMasterKey(key);
      setVault(decrypted);
      setState('UNLOCKED');
      setPassword('');
      setError(null);
      showToast('Vault unlocked');
    } catch (err) {
      setError('Invalid master password');
      showToast('Unlock failed', 'error');
    }
  };

  const handleBiometricUnlock = async () => {
    try {
      const bioKey = await verifyBiometric();
      if (bioKey) {
        const encrypted = localStorage.getItem(VAULT_STORAGE_KEY);
        if (encrypted) {
          const decrypted = decryptVault(encrypted, bioKey);
          setMasterKey(bioKey);
          setVault(decrypted);
          setState('UNLOCKED');
          setPassword('');
          setError(null);
          showToast('Biometric unlock successful');
        }
      }
    } catch (err) {
      console.error(err);
      setError('Biometric verification failed');
    }
  };

  const handleToggleBiometric = async () => {
    if (bioEnabled) {
      clearBiometric();
      setBioEnabled(false);
      showToast('Biometrics disabled');
    } else {
      if (!masterKey) return;
      try {
        await registerBiometric(masterKey);
        setBioEnabled(true);
        showToast('Biometrics enabled for this device');
      } catch (e) {
        console.error(e);
        showToast('Failed to enable biometrics', 'error');
      }
    }
  };

  const handleLock = React.useCallback(() => {
    setState('LOCKED');
    setMasterKey(null);
    setVault([]);
    setNavView('VAULT');
    setPassword('');
    showToast('Vault secured');
  }, []);

  const handleExport = () => {
    const encryptedData = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!encryptedData) {
      showToast('No vault data found', 'error');
      return;
    }

    try {
      const blob = new Blob([encryptedData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rootvault_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Vault exported successfully');
    } catch (err) {
      showToast('Export failed', 'error');
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        // Try to decrypt with current key to verify it's a valid vault file
        if (masterKey) {
          const decrypted = decryptVault(content, masterKey);
          localStorage.setItem(VAULT_STORAGE_KEY, content);
          setVault(decrypted);
          setError(null);
          showToast('Vault imported successfully');
        }
      } catch (err) {
        setError('Import failed: Invalid vault file or incorrect master password.');
        showToast('Import failed', 'error');
      }
    };
    reader.onerror = () => showToast('File read error', 'error');
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !masterKey) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        const newEntries: VaultEntry[] = data.map(row => ({
          id: generateId(),
          service: row.name || row.url || row.service || 'Imported Account',
          username: row.username || row.login_username || row.user || '',
          password: row.password || row.login_password || '',
          category: row.category || 'Imported',
          notes: row.notes || '',
          updatedAt: Date.now(),
          isFavorite: false,
        })).filter(e => e.service && e.password);

        if (newEntries.length === 0) {
          showToast('No valid entries found in CSV', 'error');
          return;
        }

        const updatedVault = [...vault, ...newEntries];
        const encrypted = encryptVault(updatedVault, masterKey);
        localStorage.setItem(VAULT_STORAGE_KEY, encrypted);
        setVault(updatedVault);
        showToast(`Imported ${newEntries.length} accounts`);
      },
      error: () => showToast('CSV Parsing Error', 'error')
    });
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const handleExportCSV = () => {
    if (vault.length === 0) return;
    const csv = Papa.unparse(vault.map(e => ({
      service: e.service,
      username: e.username,
      password: e.password,
      category: e.category,
      notes: e.notes
    })));
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rootvault_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Vault exported to CSV');
  };

  // Inactivity timeout effect
  useEffect(() => {
    if (state !== 'UNLOCKED') return;

    let timeoutId: number;

    const resetTimer = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        handleLock();
      }, autoLockMinutes * 60 * 1000);
    };

    // Events to track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Initialize timer
    resetTimer();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [state, handleLock, autoLockMinutes]);

  const handleSaveEntry = () => {
    if (!newEntry.service || !newEntry.username || !newEntry.password || !masterKey) return;

    let updatedVault: VaultEntry[];

    if (editingId) {
      updatedVault = vault.map(e => e.id === editingId ? {
        ...e,
        service: newEntry.service!,
        username: newEntry.username!,
        password: newEntry.password!,
        category: newEntry.category!,
        notes: newEntry.notes,
        updatedAt: Date.now()
      } : e);
    } else {
      const entry: VaultEntry = {
        id: generateId(),
        service: newEntry.service,
        username: newEntry.username,
        password: newEntry.password,
        category: newEntry.category || 'Login',
        notes: newEntry.notes,
        updatedAt: Date.now(),
        isFavorite: false,
      };
      updatedVault = [...vault, entry];
    }

    const encrypted = encryptVault(updatedVault, masterKey);
    localStorage.setItem(VAULT_STORAGE_KEY, encrypted);
    setVault(updatedVault);
    setIsAdding(false);
    setIsCustomCategory(false);
    setEditingId(null);
    setNewEntry({ service: '', username: '', password: '', category: 'Login', notes: '' });
    showToast(editingId ? 'Entry updated' : 'Entry saved');
  };

  const handleEditEntry = (entry: VaultEntry) => {
    setNewEntry(entry);
    setEditingId(entry.id);
    setIsAdding(true);
  };

  const handleDeleteEntry = (id: string) => {
    if (!masterKey) return;
    const updatedVault = vault.filter(e => e.id !== id);
    const encrypted = encryptVault(updatedVault, masterKey);
    localStorage.setItem(VAULT_STORAGE_KEY, encrypted);
    setVault(updatedVault);
    showToast('Entry deleted', 'success');
  };

  const toggleFavorite = (id: string) => {
    if (!masterKey) return;
    const updatedVault = vault.map(e => e.id === id ? { ...e, isFavorite: !e.isFavorite } : e);
    const encrypted = encryptVault(updatedVault, masterKey);
    localStorage.setItem(VAULT_STORAGE_KEY, encrypted);
    setVault(updatedVault);
    showToast(updatedVault.find(e => e.id === id)?.isFavorite ? 'Added to favorites' : 'Removed from favorites');
  };

  const handleWipeVault = () => {
    if (confirm("Permanently wipe all vault data? This cannot be undone.")) {
      localStorage.removeItem(VAULT_STORAGE_KEY);
      setState('SETUP');
      setVault([]);
      setMasterKey(null);
      showToast('All data purged', 'error');
    }
  };

  const calculateStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length > 8) score++;
    if (pwd.length > 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const filteredVault = useMemo(() => {
    return vault.filter(entry => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (entry.service || '').toLowerCase().includes(query) || 
                            (entry.username || '').toLowerCase().includes(query) ||
                            (entry.category || '').toLowerCase().includes(query);
      const matchesCategory = selectedCategory === 'All' || entry.category === selectedCategory;
      const matchesNav = navView === 'VAULT' || (navView === 'FAVORITES' && entry.isFavorite);
      return matchesSearch && matchesCategory && matchesNav;
    });
  }, [vault, searchQuery, selectedCategory, navView]);

  const categories = useMemo(() => {
    const base = ['All', 'Login', 'Card', 'Server', 'Other'];
    const fromVault = vault.map(e => (e as any).category).filter(Boolean) as string[];
    const unique = Array.from(new Set([...base, ...fromVault]));
    return unique;
  }, [vault]);

  const [isCustomCategory, setIsCustomCategory] = useState(false);

  // --- Render Helpers ---
  if (state === 'SETUP' || state === 'LOCKED') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 technical-grid relative overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[var(--color-sidebar)] border border-[var(--color-line)] p-6 lg:p-10 rounded-2xl shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-50" />
          
          <div className="flex flex-col items-center gap-6 mb-10">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/30 to-blue-600/30 rounded-full blur-2xl animate-pulse"></div>
              <div className="relative w-16 h-16 lg:w-20 lg:h-20 bg-zinc-900 border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl">
                <ShieldCheck className="w-8 h-8 lg:w-10 lg:h-10 text-purple-500" />
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-black tracking-tighter text-white">ROOT<span className="text-purple-500">VAULT</span></h1>
              <p className="status-label opacity-40 text-[10px] tracking-[0.4em] uppercase font-bold mt-2">Zero-Knowledge Storage</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="status-label opacity-50">Master Authority</label>
              </div>
              <div className="relative group">
                <input 
                  type="password"
                  ref={passkeyInputRef}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (state === 'SETUP' ? handleSetup() : handleUnlock())}
                  className="w-full bg-[var(--color-paper)] border border-[var(--color-line)] p-4 rounded-xl mono-value focus:outline-none focus:border-[var(--color-accent)] transition-all placeholder:opacity-20"
                  placeholder="Enter Passkey"
                />
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20 group-focus-within:opacity-50 transition-opacity" />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 text-red-400 p-4 border border-red-500/20 bg-red-500/5 rounded-xl"
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <p className="text-[10px] font-bold uppercase tracking-wider">{error}</p>
              </motion.div>
            )}

            <div className="flex gap-2">
              <button 
                onClick={state === 'SETUP' ? handleSetup : handleUnlock}
                className="flex-1 bg-[var(--color-accent)] text-white p-4 rounded-xl uppercase tracking-[0.2em] text-[10px] font-black hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
              >
                {state === 'SETUP' ? 'Initialize Root' : 'Authorize Access'}
                <ChevronRight className="w-4 h-4" />
              </button>
              
              {state === 'LOCKED' && bioSupported && bioEnabled && (
                <button 
                  onClick={handleBiometricUnlock}
                  title="Unlock with Biometrics"
                  className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 p-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center"
                >
                  <Fingerprint className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-12 flex items-center justify-center gap-4 opacity-20">
            <div className="h-px w-8 bg-white" />
            <span className="text-[10px] font-mono tracking-widest uppercase">E2EE Active</span>
            <div className="h-px w-8 bg-white" />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[var(--color-paper)] overflow-hidden">
      {/* Obsidian-style Sidebar - Desktop */}
      <aside className="hidden lg:flex w-64 bg-[var(--color-sidebar)] border-r border-[var(--color-line)] flex-col h-full shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative w-10 h-10 bg-zinc-900 ring-1 ring-white/10 rounded-lg flex items-center justify-center shadow-2xl">
              <ShieldCheck className="w-6 h-6 text-purple-500" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-black text-lg tracking-tighter text-white leading-none">ROOT</span>
            <span className="text-[10px] tracking-[0.3em] font-bold text-zinc-500 uppercase">Vault</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          <div className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] font-bold opacity-30 mb-2">Vault Explorer</div>
          
          <button
            onClick={() => { setNavView('VAULT'); setSelectedCategory('All'); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${
              navView === 'VAULT' && selectedCategory === 'All'
              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full transition-all ${navView === 'VAULT' && selectedCategory === 'All' ? 'bg-purple-400 scale-125' : 'bg-transparent group-hover:bg-zinc-600'}`} />
            All Items
          </button>

          <button
            onClick={() => setNavView('FAVORITES')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${
              navView === 'FAVORITES'
              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full transition-all ${navView === 'FAVORITES' ? 'bg-purple-400 scale-125' : 'bg-transparent group-hover:bg-zinc-600'}`} />
            Favorites
          </button>

          <div className="pt-8 px-3 py-2 text-[10px] uppercase tracking-[0.2em] font-bold opacity-30 mb-2">Collections</div>
          {categories.filter(c => c !== 'All').map(cat => (
            <button
              key={cat}
              onClick={() => { setNavView('VAULT'); setSelectedCategory(cat); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${
                navView === 'VAULT' && selectedCategory === cat 
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full transition-all ${navView === 'VAULT' && selectedCategory === cat ? 'bg-purple-400 scale-125' : 'bg-transparent group-hover:bg-zinc-600'}`} />
              {cat}
            </button>
          ))}

          <div className="pt-8 px-3 py-2 text-[10px] uppercase tracking-[0.2em] font-bold opacity-30 mb-2">Analysis</div>
          <button 
            onClick={() => setNavView('SECURITY')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${
              navView === 'SECURITY'
              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
            }`}
          >
            <Unlock className="w-4 h-4 opacity-40" />
            Security Audit
          </button>
          <button 
            onClick={() => setNavView('SETTINGS')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${
              navView === 'SETTINGS'
              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
            }`}
          >
            <Settings className="w-4 h-4 opacity-40" />
            Settings
          </button>
        </nav>

        <div className="p-4 mt-auto border-t border-[var(--color-line)] bg-black/20">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-purple-400 border border-[var(--color-line)]">
               RV
             </div>
             <div className="flex-1 min-w-0">
               <p className="text-xs font-semibold truncate text-zinc-200">Local Archive</p>
               <div className="text-[10px] text-zinc-500 truncate flex items-center gap-1">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 Ready
               </div>
             </div>
             <button 
               onClick={handleLock}
               className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors text-zinc-500 hover:text-red-400"
             >
               <LogOut className="w-4 h-4" />
             </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed inset-y-0 left-0 w-72 bg-[var(--color-sidebar)] border-r border-[var(--color-line)] flex flex-col z-50"
            >
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg blur opacity-25"></div>
                    <div className="relative w-9 h-9 bg-zinc-900 ring-1 ring-white/10 rounded-lg flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-purple-500" />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-lg tracking-tighter text-white leading-none">ROOT</span>
                    <span className="text-[10px] tracking-[0.3em] font-bold text-zinc-500 uppercase">Vault</span>
                  </div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-zinc-500">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                <div className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] font-bold opacity-30 mb-2">Vault Explorer</div>
                
                <button
                  onClick={() => { setNavView('VAULT'); setSelectedCategory('All'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                    navView === 'VAULT' && selectedCategory === 'All'
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                    : 'text-zinc-400 hover:bg-zinc-800/50'
                  }`}
                >
                  All Items
                </button>

                <button
                  onClick={() => { setNavView('FAVORITES'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                    navView === 'FAVORITES'
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                    : 'text-zinc-400 hover:bg-zinc-800/50'
                  }`}
                >
                  Favorites
                </button>

                <div className="pt-8 px-3 py-2 text-[10px] uppercase tracking-[0.2em] font-bold opacity-30 mb-2">Collections</div>
                {categories.filter(c => c !== 'All').map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setNavView('VAULT'); setSelectedCategory(cat); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                      navView === 'VAULT' && selectedCategory === cat 
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                      : 'text-zinc-400 hover:bg-zinc-800/50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}

                <div className="pt-8 px-3 py-2 text-[10px] uppercase tracking-[0.2em] font-bold opacity-30 mb-2">Analysis</div>
                <button 
                  onClick={() => { setNavView('SECURITY'); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-zinc-400 hover:bg-zinc-800/50 transition-all"
                >
                  <Unlock className="w-4 h-4 opacity-40 mr-2" />
                  Security Audit
                </button>
                <button 
                  onClick={() => { setNavView('SETTINGS'); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-zinc-400 hover:bg-zinc-800/50 transition-all"
                >
                  <Settings className="w-4 h-4 opacity-40 mr-2" />
                  Settings
                </button>
              </nav>

              <div className="p-6 mt-auto border-t border-[var(--color-line)] bg-black/20">
                <button 
                  onClick={handleLock}
                  className="w-full flex items-center justify-center gap-3 p-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold uppercase tracking-widest"
                >
                  <LogOut className="w-4 h-4" />
                  Lock Vault
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <div className="absolute inset-0 technical-grid pointer-events-none opacity-20" />
        
        {/* Top bar */}
        <header className="h-16 border-b border-[var(--color-line)] bg-[var(--color-paper)]/80 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 z-10 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400"
            >
              <nav className="w-5 h-5 flex flex-col justify-between p-0.5">
                <span className="w-full h-0.5 bg-current rounded-full" />
                <span className="w-full h-0.5 bg-current rounded-full" />
                <span className="w-full h-0.5 bg-current rounded-full" />
              </nav>
            </button>
            <div className="relative w-full max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-purple-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950/50 border border-[var(--color-line)] rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4 ml-4">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
              <ShieldCheck className="w-3 h-3 text-purple-500" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-purple-400">Encrypted</span>
            </div>
            <button 
              onClick={() => setIsAdding(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 lg:px-5 lg:py-2 rounded-xl text-[10px] lg:text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-purple-900/20"
            >
              <Plus className="w-4 h-4 lg:hidden" />
              <span className="hidden lg:inline">New Account</span>
            </button>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 z-10">
          <div className="max-w-5xl mx-auto space-y-10">
            {navView === 'SETTINGS' ? (
              <div className="space-y-8">
                <header>
                  <h1 className="text-3xl font-black text-white tracking-tight">System Settings</h1>
                  <p className="text-zinc-500 mt-2">Manage your vault environment and encryption parameters.</p>
                </header>

                <div className="grid gap-6">
                  <div className="card-glass p-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4">Data Management</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 ml-1">Native Backup</p>
                        <button 
                          onClick={handleExport}
                          className="w-full flex items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                        >
                          <Download className="w-4 h-4 text-purple-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Export .JSON</span>
                        </button>
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full flex items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                        >
                          <Upload className="w-4 h-4 text-purple-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Import .JSON</span>
                        </button>
                      </div>

                      <div className="space-y-3">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 ml-1">Cross-Platform (CSV)</p>
                        <button 
                          onClick={handleExportCSV}
                          className="w-full flex items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                        >
                          <Table className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Export .CSV</span>
                        </button>
                        <button 
                          onClick={() => csvInputRef.current?.click()}
                          className="w-full flex items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                        >
                          <FileJson className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Import .CSV</span>
                        </button>
                      </div>

                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImport} 
                        className="hidden" 
                        accept=".json"
                      />
                      <input 
                        type="file" 
                        ref={csvInputRef} 
                        onChange={handleImportCSV} 
                        className="hidden" 
                        accept=".csv"
                      />
                    </div>
                    <p className="mt-6 text-[10px] text-zinc-600 leading-relaxed italic">
                      Importing from CSV: Supported columns include "name", "url", "username", "password", "notes". Most browser exports (Chrome, Firefox) are recognized automatically.
                    </p>
                  </div>

                  <div className="card-glass p-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 font-mono">Inactivity Mode</h3>
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-black/20 rounded-xl gap-4">
                        <div>
                          <p className="text-sm font-semibold text-zinc-200">Terminal Auto-Lock</p>
                          <p className="text-xs text-zinc-500">Vault secures itself after {autoLockMinutes} minutes of total idle time</p>
                        </div>
                        <div className="flex items-center gap-2 bg-zinc-950/40 p-1 rounded-lg border border-white/5">
                          {[1, 3, 5, 10, 30].map(mins => (
                            <button 
                              key={mins}
                              onClick={() => {
                                setAutoLockMinutes(mins);
                                showToast(`Auto-lock set to ${mins} minutes`);
                              }}
                              className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${autoLockMinutes === mins ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-zinc-600 hover:text-zinc-400'}`}
                            >
                              {mins}M
                            </button>
                          ))}
                        </div>
                      </div>

                      {bioSupported && (
                        <div className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5">
                          <div>
                            <p className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                              <Fingerprint className="w-4 h-4 text-purple-400" />
                              Biometric Unlock
                            </p>
                            <p className="text-xs text-zinc-500">Use Touch ID, Face ID, or Windows Hello for quick access</p>
                          </div>
                          <button 
                            onClick={handleToggleBiometric}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${bioEnabled ? 'bg-purple-600' : 'bg-zinc-700'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${bioEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card-glass p-6 border-red-500/10">
                    <h3 className="text-sm font-bold text-red-400 uppercase tracking-widest mb-4 font-mono">Destructive Directives</h3>
                    <div className="p-4 bg-red-900/10 rounded-xl space-y-4">
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Purging the vault will erase all local shards. This action is irreversible.
                      </p>
                      <button 
                        onClick={handleWipeVault}
                        className="w-full bg-red-900/20 text-red-400 border border-red-900/30 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-900/40 transition-all"
                      >
                        Self-Destruct (Clear All Data)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : navView === 'SECURITY' ? (
              <div className="space-y-8">
                 <div className="border-b border-[var(--color-line)] pb-4">
                   <h2 className="text-3xl font-bold tracking-tighter text-white mb-1">Security Audit</h2>
                   <p className="text-xs text-zinc-500 font-medium tracking-wide">Cryptographic Strength Analysis</p>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-zinc-900/50 border border-[var(--color-line)] rounded-2xl">
                       <p className="status-label opacity-40 mb-2">Weak Keys</p>
                       <p className="text-4xl font-bold text-red-400">{vault.filter(e => calculateStrength(e.password) < 3).length}</p>
                    </div>
                    <div className="p-6 bg-zinc-900/50 border border-[var(--color-line)] rounded-2xl">
                       <p className="status-label opacity-40 mb-2">Reliable Keys</p>
                       <p className="text-4xl font-bold text-emerald-400">{vault.filter(e => calculateStrength(e.password) >= 4).length}</p>
                    </div>
                    <div className="p-6 bg-zinc-900/50 border border-[var(--color-line)] rounded-2xl">
                       <p className="status-label opacity-40 mb-2">Total Managed</p>
                       <p className="text-4xl font-bold text-purple-400">{vault.length}</p>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <h3 className="status-label opacity-20">Vulnerability Log</h3>
                    {vault.filter(e => calculateStrength(e.password) < 4).map(e => (
                      <div key={e.id} className="p-5 bg-zinc-900/30 border border-red-500/10 rounded-xl flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <ShieldAlert className="w-5 h-5 text-red-400" />
                            <div>
                               <p className="text-sm font-bold text-zinc-200 uppercase">{e.service}</p>
                               <p className="text-[10px] text-zinc-500">Inadequate bit entropy detected</p>
                            </div>
                         </div>
                         <button 
                           onClick={() => { setNavView('VAULT'); setSearchQuery(e.service); }}
                           className="text-[9px] font-black uppercase text-purple-400 hover:underline"
                         >
                           Resolve
                         </button>
                      </div>
                    ))}
                 </div>
              </div>
            ) : (
              <div className="space-y-10">
                <div className="flex items-end justify-between border-b border-[var(--color-line)] pb-4">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tighter text-white mb-1">
                      {navView === 'FAVORITES' ? 'Favorite' : selectedCategory} Records
                    </h2>
                    <p className="text-xs text-zinc-500 font-medium">{filteredVault.length} security items indexed</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <AnimatePresence mode="popLayout">
                    {filteredVault.map(entry => (
                      <VaultItem 
                        key={entry.id} 
                        entry={entry} 
                        onDelete={handleDeleteEntry} 
                        onEdit={handleEditEntry}
                        onToggleFavorite={toggleFavorite}
                        onCopy={(msg) => showToast(msg)}
                        searchQuery={searchQuery}
                      />
                    ))}
                  </AnimatePresence>

                  {filteredVault.length === 0 && (
                    <div className="col-span-full py-32 text-center rounded-3xl border-2 border-dashed border-[var(--color-line)] bg-zinc-900/20">
                      <Lock className="w-12 h-12 mx-auto text-zinc-700 mb-4 opacity-40" />
                      <p className="status-label opacity-30 text-xs tracking-[0.2em]">Zero match results in current partition</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global Action Footer */}
        <footer className="h-10 border-t border-[var(--color-line)] bg-zinc-950/50 px-6 flex items-center justify-between text-[9px] text-zinc-600 uppercase tracking-widest font-mono z-10 shrink-0">
          <div className="flex gap-6">
            <span className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-emerald-500" /> Core System: Operational</span>
            <span className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-purple-500" /> Vault Status: Verified</span>
          </div>
          <div>ROOTVAULT_V1.0.0_BUILD_RELEASE</div>
        </footer>
      </main>

      {/* Reusable Modal Component (Logic preserved, styling updated to Obsidian mood) */}
        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 50, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, scale: 0.95, x: '-50%' }}
              className="fixed bottom-12 left-1/2 z-[100] pointer-events-none"
            >
              <div className={`px-6 py-3 rounded-full shadow-2xl border flex items-center gap-3 backdrop-blur-xl ${
                toast.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span className="text-[10px] font-black uppercase tracking-widest">{toast.message}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => { setIsAdding(false); setIsCustomCategory(false); }}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[var(--color-sidebar)] border border-white/10 w-full max-w-xl rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 lg:p-8 border-b border-white/5 flex items-center justify-between bg-zinc-950/40 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400">
                    {editingId ? <Settings className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </div>
                  <h2 className="uppercase font-black tracking-widest text-[10px] lg:text-xs text-white">
                    {editingId ? 'Modify Record' : 'Create Record'}
                  </h2>
                </div>
                <button onClick={() => { setIsAdding(false); setIsCustomCategory(false); }} className="p-2 hover:bg-white/5 rounded-full transition-all text-zinc-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 lg:p-8 space-y-6 lg:space-y-8 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="status-label mb-3 block opacity-40">Identity Target</label>
                    <div className="relative group">
                       <input 
                        type="text"
                        value={newEntry.service || ''}
                        onChange={(e) => setNewEntry({...newEntry, service: e.target.value})}
                        className="w-full bg-[var(--color-paper)] border border-[var(--color-line)] p-4 rounded-xl text-sm focus:outline-none focus:border-purple-500 transition-all placeholder:text-zinc-700"
                        placeholder="Service Name (e.g. GitHub)"
                        autoFocus
                      />
                      <Globe className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
                    </div>
                  </div>
                  <div>
                    <label className="status-label mb-3 block opacity-40">Classification</label>
                    {!isCustomCategory ? (
                      <div className="relative group">
                        <select 
                          value={newEntry.category}
                          onChange={(e) => {
                            if (e.target.value === 'CUSTOM_NEW') {
                              setIsCustomCategory(true);
                              setNewEntry({...newEntry, category: ''});
                            } else {
                              setNewEntry({...newEntry, category: e.target.value});
                            }
                          }}
                          className="w-full bg-[var(--color-paper)] border border-[var(--color-line)] p-4 rounded-xl text-sm focus:outline-none focus:border-purple-500 appearance-none transition-all pr-10 cursor-pointer"
                        >
                          {categories.filter(c => c !== 'All').map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                          <option value="CUSTOM_NEW" className="text-purple-400 font-bold font-mono">+ Create New Collection...</option>
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20 rotate-90 pointer-events-none" />
                      </div>
                    ) : (
                      <div className="relative group">
                        <input 
                          type="text"
                          value={newEntry.category}
                          onChange={(e) => setNewEntry({...newEntry, category: e.target.value})}
                          className="w-full bg-[var(--color-paper)] border border-[var(--color-line)] p-4 rounded-xl text-sm focus:outline-none focus:border-purple-500 transition-all placeholder:text-zinc-700"
                          placeholder="New category name..."
                          autoFocus
                        />
                        <button 
                          onClick={() => setIsCustomCategory(false)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-purple-400 font-black uppercase tracking-tighter hover:text-purple-300"
                        >
                          Use List
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="status-label mb-3 block opacity-40">Principal / ID</label>
                    <div className="relative group">
                      <input 
                        type="text"
                        value={newEntry.username || ''}
                        onChange={(e) => setNewEntry({...newEntry, username: e.target.value})}
                        className="w-full bg-[var(--color-paper)] border border-[var(--color-line)] p-4 rounded-xl text-sm focus:outline-none focus:border-purple-500 transition-all placeholder:text-zinc-700"
                        placeholder="username or email"
                      />
                      <User className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="status-label mb-3 block opacity-40 flex justify-between items-center">
                    Cryptographic Key
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3 bg-zinc-950/40 px-3 py-1.5 rounded-lg border border-white/5">
                        <label className="flex items-center gap-1.5 cursor-pointer group">
                           <input 
                            type="checkbox" 
                            checked={genOptions.numbers} 
                            onChange={(e) => setGenOptions({...genOptions, numbers: e.target.checked})}
                            className="w-3 h-3 rounded bg-zinc-800 border-zinc-700 text-purple-500 focus:ring-0 focus:ring-offset-0"
                           />
                           <span className="text-[9px] text-zinc-500 font-bold uppercase transition-colors group-hover:text-zinc-300">123</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer group">
                           <input 
                            type="checkbox" 
                            checked={genOptions.symbols} 
                            onChange={(e) => setGenOptions({...genOptions, symbols: e.target.checked})}
                            className="w-3 h-3 rounded bg-zinc-800 border-zinc-700 text-purple-500 focus:ring-0 focus:ring-offset-0"
                           />
                           <span className="text-[9px] text-zinc-500 font-bold uppercase transition-colors group-hover:text-zinc-300">#&%</span>
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-600 font-mono italic">Length: {genLength}</span>
                        <input 
                          type="range" 
                          min="8" 
                          max="64" 
                          value={genLength}
                          onChange={(e) => setGenLength(parseInt(e.target.value))}
                          className="w-16 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => setNewEntry({...newEntry, password: generatePassword(genLength, genOptions)})}
                        className="text-purple-400 hover:text-purple-300 flex items-center gap-2 text-[9px] uppercase font-bold tracking-widest hover:scale-105 transition-all"
                      >
                        <RefreshCw className="w-3 h-3" /> Roll Generator
                      </button>
                    </div>
                  </label>
                  <div className="relative">
                    <input 
                      type="text"
                      className="w-full bg-[var(--color-paper)] border border-white/5 p-5 rounded-2xl mono-value text-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:bg-zinc-950 transition-all"
                      value={newEntry.password || ''}
                      onChange={(e) => setNewEntry({...newEntry, password: e.target.value})}
                    />
                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-10" />
                  </div>
                  
                  {/* Strength Meter in Modal */}
                  <div className="mt-4 flex gap-1 h-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div 
                        key={i} 
                        className={`flex-1 rounded-full transition-all duration-500 ${
                          i <= calculateStrength(newEntry.password || '') 
                          ? (calculateStrength(newEntry.password || '') < 3 ? 'bg-red-500/50' : calculateStrength(newEntry.password || '') < 5 ? 'bg-amber-500/50' : 'bg-emerald-500/50')
                          : 'bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[9px] uppercase tracking-widest text-zinc-600">AES-256-GCM Hardware Encrypted</p>
                    <p className={`text-[9px] font-black uppercase tracking-widest ${
                      calculateStrength(newEntry.password || '') < 3 ? 'text-red-400' : calculateStrength(newEntry.password || '') < 5 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {calculateStrength(newEntry.password || '') < 3 ? 'Critical Weakness' : calculateStrength(newEntry.password || '') < 5 ? 'Standard Grade' : 'Military Grade'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="status-label mb-3 block opacity-40">Internal Notes</label>
                  <textarea 
                    value={newEntry.notes || ''}
                    onChange={(e) => setNewEntry({...newEntry, notes: e.target.value})}
                    rows={2} 
                    className="w-full bg-[var(--color-paper)] border border-[var(--color-line)] p-4 rounded-xl text-sm focus:outline-none focus:border-purple-500 transition-all resize-none placeholder:text-zinc-800"
                    placeholder="Optional secure description..."
                  />
                </div>
              </div>

              <div className="p-6 lg:p-8 bg-black/40 flex gap-4 shrink-0">
                <button 
                  onClick={() => { setIsAdding(false); setIsCustomCategory(false); }}
                  className="flex-1 text-zinc-500 hover:text-white p-4 uppercase tracking-[0.2em] text-[10px] font-black hover:bg-white/5 rounded-2xl transition-all"
                >
                  Discard
                </button>
                <button 
                  onClick={handleSaveEntry}
                  className="flex-1 bg-purple-600 text-white p-4 rounded-2xl uppercase tracking-[0.2em] text-[10px] font-black hover:bg-purple-500 shadow-xl shadow-purple-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Record
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface VaultItemProps {
  entry: VaultEntry;
  onDelete: (id: string) => void;
  onEdit: (entry: VaultEntry) => void;
  onToggleFavorite: (id: string) => void;
  onCopy: (msg: string) => void;
  searchQuery?: string;
}

const Highlight: React.FC<{ text: string | undefined, query: string }> = ({ text, query }) => {
  if (!text) return null;
  if (!query) return <>{text}</>;
  
  // Escape regex special characters to prevent crashes
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() 
          ? <span key={i} className="bg-purple-500/30 text-purple-200 rounded-sm px-0.5">{part}</span> 
          : part
      )}
    </>
  );
};

const VaultItem: React.FC<VaultItemProps> = ({ entry, onDelete, onEdit, onToggleFavorite, onCopy, searchQuery = '' }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<'password' | 'username' | null>(null);

  const handleCopyPassword = () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(entry.password);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = entry.password;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied('password');
      onCopy('Password copied to clipboard');
    } catch(err) {
      onCopy('Failed to copy password');
    }
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyUsername = () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(entry.username);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = entry.username;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied('username');
      onCopy('Username copied to clipboard');
    } catch(err) {
      onCopy('Failed to copy username');
    }
    setTimeout(() => setCopied(null), 2000);
  };

  const getIcon = () => {
    switch(entry.category) {
      case 'Card': return <CreditCard className="w-4 h-4" />;
      case 'Server': return <RefreshCw className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-[var(--color-sidebar)] border border-[var(--color-line)] group hover:border-purple-500/50 hover:bg-zinc-900/50 transition-all relative overflow-hidden rounded-2xl p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-purple-400 group-hover:bg-purple-500/10 transition-colors border border-[var(--color-line)]">
             {getIcon()}
           </div>
           <div>
             <h3 className="font-bold tracking-tight text-zinc-100 group-hover:text-purple-400 transition-colors uppercase text-sm truncate max-w-[120px]">
               <Highlight text={entry.service} query={searchQuery} />
             </h3>
             <p className="text-[9px] uppercase font-bold tracking-widest opacity-30">
               <Highlight text={entry.category} query={searchQuery} />
             </p>
           </div>
        </div>
        <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
           <button 
             onClick={() => onToggleFavorite(entry.id)}
             className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${entry.isFavorite ? 'text-purple-400 bg-purple-500/10' : 'text-zinc-500 hover:text-purple-400 hover:bg-zinc-800'}`}
             title={entry.isFavorite ? "Remove from favorites" : "Add to favorites"}
           >
             <ShieldCheck className={`w-4 h-4 ${entry.isFavorite ? 'fill-current' : ''}`} />
           </button>
           <button 
             onClick={() => onEdit(entry)}
             className="w-10 h-10 flex items-center justify-center rounded-lg transition-all text-zinc-500 hover:text-purple-400 hover:bg-zinc-800"
             title="Edit entry"
           >
             <Settings className="w-4 h-4" />
           </button>
           <button 
             onClick={() => onDelete(entry.id)}
             className="w-10 h-10 flex items-center justify-center rounded-lg transition-all text-zinc-500 hover:text-red-400 hover:bg-red-900/20"
             title="Delete entry"
           >
             <Trash2 className="w-4 h-4" />
           </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
           <label className="text-[9px] uppercase font-bold tracking-[0.2em] opacity-20 block mb-1">Identity Principal</label>
           <div className="flex items-center justify-between gap-2">
             <div className="flex-1 bg-zinc-950 border border-white/5 rounded-xl px-4 py-2.5 flex items-center min-h-[44px]">
               <p className="text-sm font-medium text-zinc-300 truncate">
                 <Highlight text={entry.username} query={searchQuery} />
               </p>
             </div>
             <button 
               onClick={handleCopyUsername}
               className={`w-11 h-11 flex items-center justify-center rounded-xl border border-white/5 transition-all outline-none ${copied === 'username' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-950 text-zinc-500 hover:text-purple-400 hover:border-purple-500/30'}`}
             >
               {copied === 'username' ? <ShieldCheck className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
             </button>
           </div>
        </div>

        <div className="space-y-2">
           <label className="text-[9px] uppercase font-bold tracking-[0.2em] opacity-20 block mb-1">Passkey Secret</label>
           <div className="flex gap-2">
              <div className="flex-1 bg-zinc-950 border border-white/5 rounded-xl px-4 py-2.5 flex items-center justify-between min-h-[44px]">
                <span className="mono-value text-[11px] text-purple-400/80 font-bold overflow-hidden text-ellipsis">
                  {showPassword ? entry.password : '••••••••••••••••'}
                </span>
                <button onClick={() => setShowPassword(!showPassword)} className="opacity-20 hover:opacity-100 transition-opacity ml-2">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button 
                onClick={handleCopyPassword}
                className={`w-11 h-11 flex items-center justify-center rounded-xl border border-white/5 transition-all outline-none ${copied === 'password' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-950 text-zinc-500 hover:text-purple-400 hover:border-purple-500/30'}`}
              >
                {copied === 'password' ? <ShieldCheck className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
           </div>
        </div>
      </div>

      {entry.notes && (
         <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-[10px] text-zinc-500 leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5 italic">
               {entry.notes}
            </p>
         </div>
      )}

      <div className="mt-6 flex items-center justify-between">
         <span className="text-[8px] font-mono opacity-10 tracking-widest">{entry.id.substring(0,8).toUpperCase()}</span>
         <span className="text-[8px] font-mono opacity-10 uppercase tracking-widest">{new Date(entry.updatedAt).toLocaleDateString()}</span>
      </div>
    </motion.div>
  );
}
