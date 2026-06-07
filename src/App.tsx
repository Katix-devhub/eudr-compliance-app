import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ReChartsTooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  BarChart as BarChartIcon,
  LayoutDashboard, 
  Factory, 
  ClipboardCheck, 
  Send, 
  Folder, 
  Settings, 
  Plus, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Search,
  Globe,
  ChevronRight,
  Mail,
  Download,
  Info,
  LogOut,
  LogIn,
  Check,
  MapPin,
  Sparkles,
  Share2,
  Smartphone,
  QrCode,
  Award,
  ExternalLink,
  Coins,
  Shield,
  Lock
} from 'lucide-react';
import { cn } from './lib/utils';
import { useAuth } from './lib/contexts/AuthContext';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { OFFICIAL_HS_CODES, COUNTRY_RISK_BENCHMARK, OFFICIAL_REGISTRIES, SAMPLE_REAL_EXPORTERS, OfficialExporter, COMPLIANCE_METADATA } from './lib/officialData';

// --- Types ---

type Status = 'ok' | 'pending' | 'alert' | 'new';
type RiskLevel = 'high' | 'standard' | 'low';

interface Supplier {
  id: string;
  name: string;
  coop: string;
  product: string;
  country: string;
  region: string;
  qty: string;
  date: string;
  lat: string;
  lng: string;
  area: string;
  cert: string;
  hsCode: string;
  type: 'individual' | 'cooperative';
  status: Status;
  ref: string;
  email: string;
  lang: string;
  risk: RiskLevel;
  userId: string;
}

// --- Constants ---

const RELANCE_TEMPLATES: Record<string, string> = {
  "Português": "Olá {name},\n\nPara cumprir o regulamento europeu EUDR, precisamos das coordenadas GPS da sua parcela agrícola.\n\nClique no link abaixo para preencher sua ficha em 2 minutos:\n👉 [traverdy.app/ficha/{ref}]\n\nObrigado pela sua colaboração.",
  "Español": "Hola {name},\n\nPara cumplir con el reglamento europeo EUDR, necesitamos las coordenadas GPS de su parcela.\n\nHaga clic en el enlace para completar su ficha en 2 minutes:\n👉 [traverdy.app/ficha/{ref}]\n\nGracias por su colaboración.",
  "English": "Hi {name},\n\nTo comply with the EU EUDR regulation, we need the GPS coordinates of your farm plot.\n\nPlease click the link below to fill in your form in 2 minutes:\n👉 [traverdy.app/form/{ref}]\n\nThank you for your cooperation.",
  "Bahasa Indonesia": "Halo {name},\n\nUntuk memenuhi peraturan EUDR Eropa, kami memerlukan koordinat GPS lahan pertanian Anda.\n\nKlik tautan di bawah ini untuk mengisi formulir dalam 2 menit:\n👉 [traverdy.app/form/{ref}]\n\nTerima kasih atas kerja samanya.",
  "Français": "Bonjour {name},\n\nPour être conforme au règlement européen EUDR, nous avons besoin des coordonnées GPS de votre parcelle agricole.\n\nCliquez sur le lien pour compléter votre fiche en 2 minutes :\n👉 [traverdy.app/fiche/{ref}]\n\nMerci pour votre coopération.",
};

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bgColor: string; borderColor: string; desc: string; title: string }> = {
  high: { 
    label: "Risque élevé", 
    color: "text-red-600", 
    bgColor: "bg-red-50", 
    borderColor: "border-red-200",
    title: "Zone à risque élevé de déforestation",
    desc: "Les parcelles dans cette zone font l'objet d'un contrôle renforcé par les autorités européennes. Un audit documentaire approfondi est obligatoire."
  },
  standard: { 
    label: "Risque standard", 
    color: "text-amber-600", 
    bgColor: "bg-amber-50", 
    borderColor: "border-amber-200",
    title: "Zone à risque standard",
    desc: "Diligence raisonnée standard requise. Coordonnées GPS, certifications et documents légaux doivent être complets avant soumission."
  },
  low: { 
    label: "Risque faible", 
    color: "text-emerald-600", 
    bgColor: "bg-emerald-50", 
    borderColor: "border-emerald-200",
    title: "Zone à risque faible",
    desc: "Pays classé à faible risque par la Commission européenne. Procédure de diligence simplifiée applicable."
  },
};

const STATUS_CONFIG: Record<Status, { label: string; color: string; bgColor: string }> = {
  ok: { label: "Conforme", color: "text-emerald-700", bgColor: "bg-emerald-100" },
  pending: { label: "En attente", color: "text-amber-700", bgColor: "bg-amber-100" },
  alert: { label: "GPS manquant", color: "text-red-700", bgColor: "bg-red-100" },
  new: { label: "Nouveau/Invité", color: "text-blue-700", bgColor: "bg-blue-100" },
};

// --- Components ---

const Sidebar = ({ 
  onLogout, 
  onOpenBilling, 
  trialDaysRemaining,
  currentView,
  setCurrentView,
  appLang,
  onChangeAppLang
}: { 
  onLogout: () => void; 
  onOpenBilling: () => void; 
  trialDaysRemaining: number;
  currentView: 'dashboard' | 'suppliers' | 'declarations' | 'pitch';
  setCurrentView: (v: 'dashboard' | 'suppliers' | 'declarations' | 'pitch') => void;
  appLang: 'FR' | 'EN';
  onChangeAppLang: (lang: 'FR' | 'EN') => void;
}) => (
  <div className="fixed inset-y-0 left-0 w-64 bg-[#0a0f0d] text-slate-400 flex flex-col z-50">
    <div className="p-6 border-b border-white/5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 bg-[#1db954] rounded-full shadow-[0_0_8px_#1db954]" />
        <span className="font-display font-bold text-white text-xl tracking-tight">Traverdy</span>
      </div>
      <span className="px-2 py-0.5 rounded-full text-[8px] font-black bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 uppercase">PRO</span>
    </div>
    
    <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">

      <NavItem 
        icon={<LayoutDashboard size={18} />} 
        label={appLang === 'FR' ? "Tableau de bord" : "Dashboard"} 
        active={currentView === 'dashboard'} 
        onClick={() => setCurrentView('dashboard')}
      />
      <NavItem 
        icon={<Factory size={18} />} 
        label={appLang === 'FR' ? "Fournisseurs" : "Suppliers"} 
        active={currentView === 'suppliers'}
        onClick={() => setCurrentView('suppliers')}
      />
      <NavItem 
        icon={<ClipboardCheck size={18} />} 
        label={appLang === 'FR' ? "Déclarations EUDR" : "EUDR Statements"} 
        active={currentView === 'declarations'}
        onClick={() => setCurrentView('declarations')}
      />
      <NavItem 
        icon={<Coins size={18} />} 
        label={appLang === 'FR' ? "Simulateur Risques & ROI" : "Risk & ROI Simulator"} 
        active={currentView === 'pitch'} 
        onClick={() => setCurrentView('pitch')}
      />
      <NavItem icon={<Send size={18} />} label={appLang === 'FR' ? "Relances auto" : "Auto Reminders"} />
      <NavItem icon={<Folder size={18} />} label={appLang === 'FR' ? "Documents" : "Documents"} />
      <NavItem 
        icon={<CheckCircle2 size={18} className="text-[#1db954]" />} 
        label={appLang === 'FR' ? "Mon Forfait Pro" : "My Pro Plan"} 
        onClick={onOpenBilling}
      />
      
      <div className="pt-4 pb-1.5 px-4 text-[10px] uppercase font-bold tracking-widest text-slate-600">
        {appLang === 'FR' ? "Choix de Langue" : "Language Preferences"}
      </div>
      <div className="px-4 py-1 flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-slate-500">
          {appLang === 'FR' ? "Interface" : "UI Language"}
        </span>
        <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/5 shrink-0">
          <button 
            onClick={() => onChangeAppLang('FR')}
            className={`px-2 py-0.5 text-[9px] font-black rounded transition-all cursor-pointer ${appLang === 'FR' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            FR
          </button>
          <button 
            onClick={() => onChangeAppLang('EN')}
            className={`px-2 py-0.5 text-[9px] font-black rounded transition-all cursor-pointer ${appLang === 'EN' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            EN
          </button>
        </div>
      </div>

      <div className="pt-2 pb-2 px-4 text-[10px] uppercase font-bold tracking-widest text-slate-600">
        {appLang === 'FR' ? "Données Officielles" : "Official Registries"}
      </div>
      {OFFICIAL_REGISTRIES.map(reg => (
        <a key={reg.name} href={reg.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2 text-xs hover:text-white transition-colors">
          <Globe size={14} />
          <span className="truncate">{reg.name}</span>
        </a>
      ))}
      <div className="mt-4 px-4 py-3 bg-white/5 rounded-lg border border-white/5">
        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Compliance Engine</div>
        <div className="text-[10px] font-mono text-[#1db954] mt-1">v{COMPLIANCE_METADATA.version} · {COMPLIANCE_METADATA.lastUpdate}</div>
      </div>

      <div className="mt-4 px-4 py-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 bg-[#1db954] rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-[#1db954] uppercase tracking-widest">
            {appLang === 'FR' ? "Version d'essai" : "Free Trial"}
          </span>
        </div>
        <p className="text-[10px] text-slate-300">
          {appLang === 'FR' 
            ? `${trialDaysRemaining} jours restants avant le passage au plan Pro.` 
            : `${trialDaysRemaining} days remaining before Pro upgrade.`}
        </p>
      </div>
      
      <div className="mt-auto p-4">
        <div className="bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-2xl p-4 border border-white/10">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">
            {appLang === 'FR' ? "Statut de Confiance" : "Trust Status"}
          </p>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={12} className="text-emerald-500" />
            <span className="text-[11px] text-white font-medium">ISO 27001 Certified</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <CheckCircle2 size={12} className="text-emerald-500" />
            <span className="text-[11px] text-white font-medium">RGPD & EUDR Compliant</span>
          </div>
        </div>
      </div>

      <NavItem icon={<Settings size={18} />} label={appLang === 'FR' ? "Paramètres" : "Settings"} />
    </nav>

    <div className="p-4 border-t border-white/5 space-y-2">
      <button 
        onClick={onLogout}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-500/10 hover:text-red-400 transition-all cursor-pointer"
      >
        <LogOut size={18} />
        <span>{appLang === 'FR' ? "Déconnexion" : "Log out"}</span>
      </button>
    </div>
  </div>
);

const NavItem = ({ icon, label, active = false, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={`
    flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer
    ${active 
      ? 'bg-white/5 text-[#1db954] border-l-2 border-[#1db954]' 
      : 'hover:bg-white/5 hover:text-white border-l-2 border-transparent'}
  `}>
    {icon}
    <span>{label}</span>
  </div>
);

const KpiCard = ({ icon, value, label, sub, colorClass }: { icon: React.ReactNode, value: string | number, label: string, sub: string, colorClass: string }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
    <div className="flex justify-between items-start mb-2">
      <span className={`p-2 rounded-lg bg-slate-50 ${colorClass}`}>
        {icon}
      </span>
    </div>
    <div className="font-display text-3xl font-extrabold tracking-tight">{value}</div>
    <div className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">{label}</div>
    <div className={`text-[10px] font-bold mt-2 flex items-center gap-1 ${colorClass}`}>
      {sub}
    </div>
  </div>
);

// --- Dashboard Components ---

const DashboardOverview = ({ stats, suppliers }: { stats: any, suppliers: Supplier[] }) => {
  const riskData = useMemo(() => {
    const counts = { high: 0, standard: 0, low: 0 };
    suppliers.forEach(s => counts[s.risk]++);
    return [
      { name: 'Élevé', value: counts.high, color: '#ef4444' },
      { name: 'Standard', value: counts.standard, color: '#f59e0b' },
      { name: 'Faible', value: counts.low, color: '#10b981' },
    ];
  }, [suppliers]);

  const productData = useMemo(() => {
    const products: Record<string, number> = {};
    suppliers.forEach(s => {
      products[s.product] = (products[s.product] || 0) + 1;
    });
    return Object.entries(products).map(([name, value]) => ({ name, value }));
  }, [suppliers]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
           <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Répartition du Risque EUDR</h3>
                <p className="text-xs text-slate-500 mt-1">Niveau de risque selon le benchmark de la Commission Européenne.</p>
              </div>
              <div className="flex gap-4">
                {riskData.map(r => (
                  <div key={r.name} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{r.name}</span>
                  </div>
                ))}
              </div>
           </div>
           <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={riskData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis 
                   dataKey="name" 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} 
                 />
                 <YAxis 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} 
                 />
                 <ReChartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                 />
                 <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={60}>
                   {riskData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                   ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
           <h3 className="text-sm font-bold text-slate-900 mb-6">Conformité Totale</h3>
           <div className="flex-1 flex flex-col items-center justify-center">
              <div className="relative w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Conformes', value: stats.conformes },
                        { name: 'Non-conformes', value: stats.total - stats.conformes }
                      ]}
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#1db954" />
                      <Cell fill="#f1f5f9" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-slate-900">{stats.score}%</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Complété</span>
                </div>
              </div>
              <div className="mt-8 space-y-3 w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#1db954]" />
                    <span className="text-xs font-semibold text-slate-600">Dossiers OK</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900">{stats.conformes}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                    <span className="text-xs font-semibold text-slate-600">Manquants</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900">{stats.total - stats.conformes}</span>
                </div>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-6">Répartition par Commodity</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} width={80} />
                  <ReChartsTooltip />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-white opacity-10 group-hover:scale-110 transition-transform">
               <Globe size={180} />
            </div>
            <div className="relative z-10 h-full flex flex-col">
              <span className="px-3 py-1 bg-[#1db954] text-white text-[10px] font-bold rounded-full uppercase tracking-widest w-fit">Status Global</span>
              <h2 className="text-2xl font-bold text-white mt-4 mb-2 tracking-tight">Prêt pour audit légal</h2>
              <p className="text-slate-400 text-sm leading-relaxed max-w-[280px]">
                Votre portefeuille de fournisseurs est conforme à {stats.score}% aux exigences du règlement EUDR.
              </p>
              <div className="mt-auto pt-8 flex gap-4">
                 <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dernière Update</p>
                    <p className="text-white font-mono text-sm">{new Date().toLocaleDateString()}</p>
                 </div>
                 <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Certificats Validés</p>
                    <p className="text-white font-mono text-sm">{Math.floor(stats.conformes * 1.2)}</p>
                 </div>
              </div>
            </div>
         </div>
      </div>
    </div>
  );
};

const StepItem = ({ num, label, desc, done }: { num: string; label: string; desc: string; done: boolean }) => (
  <div className="flex items-start gap-4 p-4 rounded-xl transition-all duration-300">
    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${done ? 'bg-[#1db954] border-[#1db954] text-white' : 'border-slate-200 text-slate-400'}`}>
      {done ? <Check size={16} /> : num}
    </div>
    <div>
      <p className={`text-xs font-bold ${done ? 'text-slate-900 line-through opacity-50' : 'text-slate-900'}`}>{label}</p>
      <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{desc}</p>
    </div>
  </div>
);

const ComplianceDeclarations = ({ suppliers, onNotif }: { suppliers: Supplier[], onNotif: (i: string, m: string) => void }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const okSuppliers = suppliers.filter(s => s.status === 'ok');

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-900 rounded-3xl p-10 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10">
          <FileText size={200} />
        </div>
        <div className="relative z-10 max-w-xl">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Générateur de Déclaration Annex II</h2>
          <p className="text-slate-400 leading-relaxed mb-8">
            Le règlement EUDR impose une déclaration de diligence raisonnée pour chaque mise sur le marché.
            Générez vos fichiers JSON techniques ou PDF légaux en un clic pour les dossiers prêts.
          </p>
          <div className="flex gap-4">
             <button 
                onClick={() => onNotif('📄', "Préparation du paquet de 4 déclarations groupées...")}
                className="px-6 py-3 bg-[#1db954] text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2"
             >
                <ClipboardCheck size={18} /> Tout exporter (PDF)
             </button>
             <button className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-all">
                Format JSON (Customs)
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {okSuppliers.length === 0 ? (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl">
            <Info className="mx-auto opacity-20 mb-4" size={48} />
            <h3 className="text-lg font-bold text-slate-900">Aucun dossier conforme</h3>
            <p className="text-sm text-slate-500 mt-2">Validez vos dossiers fournisseurs pour pouvoir générer les documents légaux.</p>
          </div>
        ) : (
          okSuppliers.map(s => (
            <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-6">
                 <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                   <FileText size={20} />
                 </div>
                 <span className="text-[10px] font-mono text-slate-400">EU-{s.ref}</span>
              </div>
              <h4 className="font-bold text-slate-900">{s.name}</h4>
              <p className="text-xs text-slate-500 mt-1 mb-6">{s.product} · {s.country}</p>
              
              <div className="space-y-3">
                 <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    <Check size={12} className="text-emerald-500" /> GPS Validé
                 </div>
                 <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    <Check size={12} className="text-emerald-500" /> Satellite Clean
                 </div>
                 <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    <Check size={12} className="text-emerald-500" /> Signé Annex II
                 </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-50 flex gap-2">
                 <button className="flex-1 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-tighter">Download PDF</button>
                 <button className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">Details</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- Default Demo Suppliers Array (Accessible Globally) ---
const INITIAL_DEMO_SUPPLIERS: Supplier[] = [
  {
    id: 'demo-1',
    name: 'Cooperativa Café Brasil',
    coop: 'Coop Café Brasil',
    product: 'Café',
    country: 'Brésil',
    region: 'Minas Gerais',
    qty: '150 tonnes',
    date: '2026-05-18',
    lat: '-18.9186',
    lng: '-48.2772',
    area: '45 hectares',
    cert: 'Rainforest Alliance',
    hsCode: '0901',
    type: 'cooperative',
    status: 'ok',
    ref: '0901-BR-2026-455',
    email: 'contact@cafe-brasil.coop',
    lang: 'Português',
    risk: 'low',
    userId: 'demo_user_katia'
  },
  {
    id: 'demo-2',
    name: 'IndoSpices PT',
    coop: 'N/A',
    product: 'Soja',
    country: 'Indonésie',
    region: 'Sumatra',
    qty: '40 tonnes',
    date: '2026-05-15',
    lat: '',
    lng: '',
    area: '12 hectares',
    cert: 'Vérification en cours',
    hsCode: '1201',
    type: 'individual',
    status: 'alert',
    ref: '1201-ID-2026-112',
    email: 'info@indospices.com',
    lang: 'Bahasa Indonesia',
    risk: 'standard',
    userId: 'demo_user_katia'
  },
  {
    id: 'demo-3',
    name: 'Société Coopérative Ivoirienne de Cacao (SCCI)',
    coop: 'SCCI Cacao',
    product: 'Cacao',
    country: 'Côte d’Ivoire',
    region: 'Bas-Sassandra',
    qty: '85 tonnes',
    date: '2026-05-10',
    lat: '5.2534',
    lng: '-6.0712',
    area: '28 hectares',
    cert: 'UTZ Certified',
    hsCode: '1801',
    type: 'cooperative',
    status: 'ok',
    ref: '1801-CI-2026-903',
    email: 'contact@sccicacao.ci',
    lang: 'Français',
    risk: 'high',
    userId: 'demo_user_katia'
  }
];

// --- Public Portal Multi-language Dictionary ---
const PORTAL_LANG_DICTIONARY: Record<string, {
  title: string;
  subtitle: string;
  hello: string;
  instructions: string;
  gpsTitle: string;
  gpsDesc: string;
  areaTitle: string;
  harvestDateTitle: string;
  certificationTitle: string;
  signatureTitle: string;
  legalText: string;
  submitButton: string;
  successTitle: string;
  successDesc: string;
  detectLocation: string;
  manualLat: string;
  manualLng: string;
}> = {
  "Português": {
    title: "Portal do Produtor - Conformidade EUDR",
    subtitle: "Seção de coleta de dados de parcelas agrícolas ecológicas.",
    hello: "Olá",
    instructions: "Para exportar seus produtos para o mercado europeu, você deve preencher este formulário obrigatório com as coordenadas GPS exatas do seu lote de terra.",
    gpsTitle: "Coordenadas Geográficas (GPS)",
    gpsDesc: "Insira as coordenadas ou clique abaixo para se localizar numericamente.",
    areaTitle: "Área da Parcela (Hectares)",
    harvestDateTitle: "Data da Colheita",
    certificationTitle: "Certificação Agrícola / Selo",
    signatureTitle: "Assinatura Eletrônica (Nome Completo)",
    legalText: "Declaro sob juramento que os produtos colhidos provêm de áreas que não sofreram desmatamento após 31 de dezembro de 2020.",
    submitButton: "Enviar Minha Ficha de Conformidade",
    successTitle: "Dados Enviados com Sucesso!",
    successDesc: "Muito obrigado por sua cooperação. Nosso sistema iniciou o processo de auditoria de imagens de satélite para validar seu lote em tempo real.",
    detectLocation: "Me Detectar Agora (GPS)",
    manualLat: "Latitude",
    manualLng: "Longitude"
  },
  "Español": {
    title: "Portal del Productor - Conformidad EUDR",
    subtitle: "Sección de recolección de datos de parcelas de cultivo.",
    hello: "Hola",
    instructions: "Para permitir la exportación de sus productos a la Unión Europea, debe completar este formulario obligatorio declarando las coordenadas GPS precisas de su parcela.",
    gpsTitle: "Coordenadas Geográficas (GPS)",
    gpsDesc: "Ingrese las coordenadas o use la detección automática.",
    areaTitle: "Superficie de la Parcela (Hectáreas)",
    harvestDateTitle: "Fecha de Cosecha",
    certificationTitle: "Certificación Agrícola / Sello",
    signatureTitle: "Firma Electrónica (Nombre completo)",
    legalText: "Declaro bajo juramento que los productos recolectados provienen de parcelas agrícolas libres de deforestación desde el 31 de diciembre de 2020.",
    submitButton: "Enviar Ficha de Conformidad",
    successTitle: "¡Formulario Enviado con Éxito!",
    successDesc: "Muchas gracias por su colaboración. El análisis por satélite de su parcela comenzará de inmediato para verificar su conformidad.",
    detectLocation: "Detectar mi Ubicación (GPS)",
    manualLat: "Latitud",
    manualLng: "Longitud"
  },
  "Bahasa Indonesia": {
    title: "Portal Petani - Kepatuhan EUDR Eropa",
    subtitle: "Divisi pengumpulan koordinat geografis area pertanian.",
    hello: "Halo",
    instructions: "Untuk mengizinkan ekspor produk Anda ke Uni Eropa, Anda wajib mengisi formulir ini dengan koordinat GPS lahan Anda.",
    gpsTitle: "Koordinat Geografis (GPS)",
    gpsDesc: "Masukkan koordinat secara manual atau gunakan deteksi lokasi otomatis.",
    areaTitle: "Luas Lahan (Hektar)",
    harvestDateTitle: "Tanggal Panen",
    certificationTitle: "Sertifikasi Pertanian / Label",
    signatureTitle: "Tanda Tangan Elektronik (Nama Lengkap)",
    legalText: "Saya menyatakan dengan sejujur-jujurnya bahwa komoditas yang dipanen berasal dari lahan pertanian yang bebas dari deforestasi sejak 31 Desember 2020.",
    submitButton: "Kirim Formulir Kepatuhan",
    successTitle: "Formulir Berhasil Dikirim!",
    successDesc: "Terima kasih atas kerja sama Anda. Analisis satelit otomatis pada lahan Anda telah dimulai demi memvalidasi dokumen ekspor.",
    detectLocation: "Deteksi GPS Saya otomatis",
    manualLat: "Garis Lintang (Latitude)",
    manualLng: "Garis Bujur (Longitude)"
  },
  "English": {
    title: "Producer Compliance Portal - EUDR",
    subtitle: "Agricultural parcel geolocation collection office.",
    hello: "Hello",
    instructions: "To comply with the new European Deforestation Regulation (EUDR), you must submit this required form with the precise GPS coordinates of your plot of land.",
    gpsTitle: "Geographical Coordinates (GPS)",
    gpsDesc: "Enter the coordinates manually or click below to auto-locate your device.",
    areaTitle: "Plot Surface Area (Hectares)",
    harvestDateTitle: "Harvesting Date",
    certificationTitle: "Agricultural Certification / Label",
    signatureTitle: "Electronic Signature (Full Name)",
    legalText: "I officially declare on my honor that the harvested products originate from plots of land free from deforestation since December 31, 2020.",
    submitButton: "Submit Compliance Form",
    successTitle: "Form Submitted Successfully!",
    successDesc: "Thank you for your cooperation! Our automated satellite vision system has begun auditing your plot in real-time.",
    detectLocation: "Auto-Detect My GPS",
    manualLat: "Latitude",
    manualLng: "Longitude"
  },
  "Français": {
    title: "Portail Producteur - Conformité EUDR",
    subtitle: "Collecte sécurisée des coordonnées géographiques des parcelles.",
    hello: "Bonjour",
    instructions: "Conformément au règlement européen sur la déforestation (EUDR), vous devez renseigner ce formulaire obligatoire avec les coordonnées GPS précises de vos parcelles agricoles.",
    gpsTitle: "Coordonnées Géographiques (GPS)",
    gpsDesc: "Saisissez vos coordonnées de récolte ou utilisez la détection automatique.",
    areaTitle: "Surface de la Parcelle (Hectares)",
    harvestDateTitle: "Date de Récolte",
    certificationTitle: "Certification Agricole (Label)",
    signatureTitle: "Signature Numérique (Nom Complet)",
    legalText: "Je déclare sur l'honneur que les produits récoltés proviennent de parcelles agricoles libres de déforestation depuis le 31 décembre 2020.",
    submitButton: "Soumettre ma Fiche de Conformité",
    successTitle: "Fiche Transmise avec Succès !",
    successDesc: "Merci pour votre coopération. L'audit automatisé par satellite de votre parcelle va démarrer pour certifier sa conformité aux normes douanières de l'UE.",
    detectLocation: "Obtenir mon GPS automatiquement",
    manualLat: "Latitude",
    manualLng: "Longitude"
  }
};

// --- Landing Page Multi-language Dictionary ---
const LANDING_DICTS = {
  FR: {
    navFeatures: "Fonctionnalités",
    navCompliance: "Réglementation",
    navPortal: "Portail Producteur",
    navPricing: "Tarifs",
    sandboxBtn: "Mode Sandbox ⚡",
    loginBtn: "Se connecter / S'enregistrer",
    badgeEudr: "Conforme EUDR",
    tagline: "🇪🇺 Règlement Européen sur la Déforestation (EUDR)",
    heroTitle: "Garantissez la conformité de vos importations et l'accès au marché européen",
    heroSubtitle: "La plateforme de diligence raisonnée tout-en-un. Collectez les coordonnées GPS et parcelles, vérifiez l'historique forestier par imagerie satellite et générez vos déclarations réglementaires obligatoires de manière automatisée.",
    demoBtn: "Démo Sandbox Instantanée ⚡",
    createProBtn: "Créer mon compte Pro",
    bullet1: "Sans engagement",
    bullet2: "Accès direct sans CB",
    bullet3: "Démonstration 100% active",
    previewTitle: "Traverdy Pro",
    previewStatus: "Aperçu en direct",
    previewCompliance: "Indice de conformité",
    previewCompliant: "↑ Conforme",
    previewAudited: "Coopératives auditées",
    previewAuditedSub: "Diligence raisonnée automatisée",
    previewSatellite: "Dernier rapport satellite",
    previewNoRisk: "Aucun risque détecté",
    previewSentinel: "✓ Sentinel L2A Validé",
    previewMapTitle: "Cartographie dynamique des matières premières (Café, Cacao)",
    previewMapDesc: "Les polygones de parcelles sont superposés en temps réel avec le référentiel d'alertes déforestation européen et l'indice Copernicus.",
    featuresTitleBadge: "Fonctionnalités Clés",
    featuresTitle: "Une suite technologique complète et souveraine",
    featuresDesc: "Traverdy automatise l'ensemble de la chaîne de gouvernance EUDR, de la collecte d'informations terrain auprès des producteurs jusqu'au dossier de preuves douanier.",
    feature1Title: "Géolocalisation précise",
    feature1Desc: "Collecte native des coordonnées GPS (points et polygones) via notre portail producteur optimisé pour mobiles sans installation d'application.",
    feature2Title: "Vérification Satellite",
    feature2Desc: "Audit automatique de la déforestation historique en croisant les parcelles déclarées avec les données d'imagerie Copernic/Sentinel.",
    feature3Title: "Relances Autonomes",
    feature3Desc: "Relancez automatiquement vos producteurs dans leur langue d'origine (Portugais, Espagnol, Anglais, Français, Bahasa) par WhatsApp et SMS.",
    feature4Title: "Dossier de Preuves",
    feature4Desc: "Éditez automatiquement vos déclarations de diligence raisonnée (DDS Format EU) prêtes à l'envoi immédiat pour éviter tout blocage en douane.",
    complianceBadge: "Calendrier & Obligations",
    complianceTitle: "Une échéance légale stricte pour tous les importateurs européens",
    complianceDesc1: "Toutes les entreprises importantes et moyennes important du café, cacao, soja, huile de palme, bovins, caoutchouc et bois en Europe doivent obligatoirement prouver que leurs produits ne sont pas issus de parcelles déboisées après le 31 décembre 2020.",
    complianceDesc2: "En cas de non-conformité : blocage immédiat en douanes, amende jusqu'à 4% du chiffre d'affaires annuel et interdiction d'exercer.",
    complianceGuaranteeTitle: "Garantie Traverdy",
    complianceGuaranteeDesc: "Notre algorithme applique strictement le benchmark de risque pays actualisé de la Commission européenne pour chaque origine.",
    complianceMaterialsTitle: "Statuts Matières EUDR",
    complianceMaterialsCoffee: "☕ Café (HS 0901)",
    complianceMaterialsCocoa: "🍫 Cacao (HS 1801)",
    complianceMaterialsWood: "🪵 Bois & Papiers",
    complianceMaterialsRubber: "🛞 Caoutchouc",
    complianceMaterialsActive: "Actif",
    auditBtn: "Démarrer un Audit",
    portalDemoBadge: "Test instantané",
    portalDemoTitle: "Simulez l'expérience d'un producteur agricole",
    portalDemoDesc: "Saisissez une référence de fournisseur démo (par exemple P001, P002, P003 ou P004) ci-dessous pour ouvrir et visualiser le portail public autonome envoyé au producteur par SMS pour collecter ses coordonnées GPS.",
    portalDemoInputPlaceholder: "Ex : P001, P002, P003...",
    portalDemoSubmit: "Ouvrir le portail ⚡",
    footerDesc: "Traverdy aide les importateurs à se conformer au RDUE / EUDR. En naviguant sur ce site, vous acceptez nos conditions d'utilisation et notre politique de conservation sécurisée des données de géolocalisation.",
    footerCopyright: "Tous droits réservés. Plateforme d'audit et de conformité forestière.",
    modalTitle: "Se connecter ou créer un compte",
    modalSubtitle: "Accédez de manière sécurisée à votre tableau de bord de diligence raisonnée EUDR.",
    modalGoogleBtn: "Connexion sécurisée avec Google",
    modalSandboxBtn: "Accéder via le Mode Sandbox / Démo",
    modalClose: "Fermer",
    modalTipTitle: "💡 Astuce d'évaluation :",
    modalTipDesc: "Le bouton Mode Sandbox / Démo est sans configuration et fonctionne directement dans cet iframe pour vous permettre de tester immédiatement 100% des outils (carte, importations, déclarations).",
    modalLegal: "En vous connectant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité liée au règlement européen sur la déforestation (EUDR).",
    pricingTitleBadge: "Tarification",
    pricingTitle: "Des tarifs clairs, adaptés à vos volumes d'importation",
    pricingSubtitle: "Commencez gratuitement en mode Sandbox pour tester l'intégralité des outils, puis activez votre conformité en production.",
    pricingPeriod: "mois",
    pricingFreeName: "Essai Sandbox",
    pricingFreePrice: "0€",
    pricingFreeDesc: "Idéal pour tester la solution et évaluer l'expérience producteur.",
    pricingFreeFeat1: "Jusqu'à 4 fournisseurs démo",
    pricingFreeFeat2: "Simulateur de coordonnées GPS interactif",
    pricingFreeFeat3: "Rapports d'audit satellite de simulation",
    pricingFreeFeat4: "Déclarations DDS de test fictives",
    pricingFreeFeat5: "Support communautaire standard",
    pricingProName: "Traverdy Pro",
    pricingProPrice: "499€",
    pricingProDesc: "L'outil tout-en-un pour les importateurs et négociants.",
    pricingProFeat1: "Nombre illimité de fournisseurs actifs",
    pricingProFeat2: "Relances automatiques WhatsApp & SMS",
    pricingProFeat3: "Vraie vérification satellite Copernicus intégrée",
    pricingProFeat4: "Génération de dossiers de preuves réglementaires",
    pricingProFeat5: "Support prioritaire par email & chat sous 24h",
    pricingEnterpriseName: "Grand Compte",
    pricingEnterprisePrice: "Sur devis",
    pricingEnterpriseDesc: "Pour les multinationales et coopératives d'envergure globale.",
    pricingEnterpriseFeat1: "Accès API complet et connecteur ERP (SAP)",
    pricingEnterpriseFeat2: "Imagerie satellite ultra-haute résolution",
    pricingEnterpriseFeat3: "Conseil juridique & conformité réglementaire",
    pricingEnterpriseFeat4: "Garantie SLA 99.9% de disponibilité",
    pricingEnterpriseFeat5: "Account Manager & ingénieur support dédié",
    pricingSelectBtn: "Démarrer l'audit gratuit",
    pricingContactBtn: "Contacter le service commercial",
    gdprBannerTitle: "Respect de votre vie privée et conformité RGPD",
    gdprBannerText: "Traverdy utilise des cookies techniques essentiels pour faire fonctionner la plateforme (authentification, sécurité, session, sélecteurs linguistiques) et sauvegarder vos choix légaux de manière souveraine. Aucun traceur publicitaire tiers n'est utilisé.",
    gdprBtnAccept: "Accepter et continuer",
    gdprBtnEssential: "Uniquement l'essentiel",
    gdprBtnRefuse: "Continuer sans accepter",
    gdprBtnLearnMore: "En savoir plus",
    gdprModalTitle: "Politique de gestion des Cookies & RGPD",
    gdprModalIntro: "Conformément au Règlement Général sur la Protection des Données (RGPD) du Parlement européen et du Conseil (Règlement UE 2016/679), Traverdy s'engage à assurer la transparence totale, la protection maximale et la souveraineté de vos données.",
    gdprTableColCookie: "Cookie / Stockage",
    gdprTableColType: "Type",
    gdprTableColPurpose: "Raison d'être & Utilisation",
    gdprTableColDuration: "Durée de conservation",
    gdprRow1Name: "traverdy_app_lang",
    gdprRow1Type: "Technique (Local)",
    gdprRow1Purpose: "Mémorise votre langue de navigation préférée (Français ou Anglais) pour vous offrir un affichage instantané adapté sans recharger le serveur.",
    gdprRow1Duration: "Persistant (jusqu'au nettoyage de votre navigateur)",
    gdprRow2Name: "traverdy_gdpr_consent",
    gdprRow2Type: "Technique (Local)",
    gdprRow2Purpose: "Mémorise votre choix de consentement ainsi que vos préférences relatives à l'utilisation des cookies techniques et des cookies d'évaluation.",
    gdprRow2Duration: "1 an",
    gdprRow3Name: "demo_suppliers / demo_declarations",
    gdprRow3Type: "Technique de session",
    gdprRow3Purpose: "Permet de conserver vos modifications (fournisseurs créés, parcelles cartographiées, déclarations éditées) localement dans l'iframe de démo afin que vos données ne soient jamais exposées publiquement.",
    gdprRow3Duration: "Persistant ou Session",
    gdprModalSec2Title: "Vos Droits & Vos Garanties Souveraines",
    gdprModalSec2Text: "Toutes nos bases de données clients réels sont hébergées au sein d'infrastructures hautement sécurisées situées exclusivement en Europe (Europe de l'Ouest / Cloud Run & Firestore). Vos données d'importation, de géolocalisation de parcelles, d'audits satellites et de déclarations de diligence raisonnée (DDS) sont chiffrées au repos et en transit et ne feront jamais l'objet d'un transfert commercial à des tiers. Vous disposez d'un droit permanent d'accès, d'export complet, de rectification et d'effacement total de vos données en écrivant à notre délégué à la protection des données.",
    gdprModalClose: "Fermer et enregistrer mes choix"
  },
  EN: {
    navFeatures: "Features",
    navCompliance: "Regulations",
    navPortal: "Producer Portal",
    navPricing: "Pricing",
    sandboxBtn: "Sandbox Mode ⚡",
    loginBtn: "Log In / Register",
    badgeEudr: "EUDR Compliant",
    tagline: "🇪🇺 European Union Deforestation Regulation (EUDR)",
    heroTitle: "Ensure compliance of your imports and secure access to the European market",
    heroSubtitle: "The all-in-one due diligence platform. Collect GPS coordinates and land parcels, audit forest history using satellite imagery, and generate mandatory regulatory declarations automatically.",
    demoBtn: "Instant Sandbox Demo ⚡",
    createProBtn: "Create Pro Account",
    bullet1: "No commitment",
    bullet2: "Direct access (No CC)",
    bullet3: "100% interactive demo",
    previewTitle: "Traverdy Pro",
    previewStatus: "Live preview",
    previewCompliance: "Compliance Rate",
    previewCompliant: "↑ Compliant",
    previewAudited: "Audited coops",
    previewAuditedSub: "Automated due diligence",
    previewSatellite: "Latest satellite report",
    previewNoRisk: "No risk detected",
    previewSentinel: "✓ Sentinel L2A Verified",
    previewMapTitle: "Dynamic raw materials mapping (Coffee, Cocoa)",
    previewMapDesc: "Parcel polygons are overlaid in real-time with the European deforestation alert database and Copernicus index.",
    featuresTitleBadge: "Key Capabilities",
    featuresTitle: "A complete and sovereign technological suite",
    featuresDesc: "Traverdy automates the entire EUDR governance chain, from field data collection with producers to customs proof packages.",
    feature1Title: "Precise Geolocation",
    feature1Desc: "Native GPS coordinates and polygon collection via our mobile-optimized producer portal. No app installation needed.",
    feature2Title: "Satellite Audits",
    feature2Desc: "Automatic analysis of historical forest changes by crossing declared parcels with Copernicus/Sentinel satellite imagery.",
    feature3Title: "Autonomic Reminders",
    feature3Desc: "Automatically send reminders to your producers in their native language (Portuguese, Spanish, English, French, Bahasa) via WhatsApp & SMS.",
    feature4Title: "Customs Proof Pack",
    feature4Desc: "Automatically generate your due diligence statements (DDS EU format) ready for customs to avoid any border delay.",
    complianceBadge: "Timeline & Mandate",
    complianceTitle: "A strict legal deadline for all European importers",
    complianceDesc1: "All major and medium enterprises importing coffee, cocoa, soy, palm oil, cattle, rubber, and wood into Europe must prove that their commodities do not come from deforested plots after December 31, 2020.",
    complianceDesc2: "In case of non-compliance: immediate customs holds, fines up to 4% of global annual turnover, and trading bans.",
    complianceGuaranteeTitle: "Traverdy Guarantee",
    complianceGuaranteeDesc: "Our algorithm strictly applies the country risk benchmark updated by the European Commission for each origin.",
    complianceMaterialsTitle: "EUDR Commodity Status",
    complianceMaterialsCoffee: "☕ Coffee (HS 0901)",
    complianceMaterialsCocoa: "🍫 Cocoa (HS 1801)",
    complianceMaterialsWood: "🪵 Wood & Paper",
    complianceMaterialsRubber: "🛞 Rubber",
    complianceMaterialsActive: "Active",
    auditBtn: "Start an Audit",
    portalDemoBadge: "Instant Test",
    portalDemoTitle: "Simulate a farmer/producer experience",
    portalDemoDesc: "Enter a demo supplier reference (e.g., P001, P002, P003, or P004) below to open and view the public portal sent to farmers by SMS to collect their GPS coordinates.",
    portalDemoInputPlaceholder: "E.g., P001, P002, P003...",
    portalDemoSubmit: "Open Portal ⚡",
    footerDesc: "Traverdy helps importers comply with EUDR. By browsing this site, you accept our terms of service and our secure geodata retention policy.",
    footerCopyright: "All rights reserved. Forest compliance & audit platform.",
    modalTitle: "Log In or Create an Account",
    modalSubtitle: "Access your EUDR due diligence dashboard securely.",
    modalGoogleBtn: "Secure Log In with Google",
    modalSandboxBtn: "Access via Sandbox / Demo Mode",
    modalClose: "Close",
    modalTipTitle: "💡 Evaluation Tip:",
    modalTipDesc: "The Sandbox / Demo Mode button bypasses configuration and works directly in this iframe to let you test 100% of capabilities immediately (map, uploads, declarations).",
    modalLegal: "By logging in, you accept our terms of use and our privacy policy associated with the European Deforestation Regulation (EUDR).",
    pricingTitleBadge: "Pricing Plans",
    pricingTitle: "Simple pricing tailored to your import volume",
    pricingSubtitle: "Start for free in Sandbox mode to explore 100% of the platform, then migrate when you are ready to certify.",
    pricingPeriod: "month",
    pricingFreeName: "Sandbox Trial",
    pricingFreePrice: "$0",
    pricingFreeDesc: "Perfect to evaluate the platform and try the producer flow.",
    pricingFreeFeat1: "Up to 4 active demo suppliers",
    pricingFreeFeat2: "Interactive GPS plot simulator",
    pricingFreeFeat3: "Simulated satellite audit reports",
    pricingFreeFeat4: "Watermarked test DDS certificates",
    pricingFreeFeat5: "Standard community support",
    pricingProName: "Traverdy Pro",
    pricingProPrice: "$499",
    pricingProDesc: "The complete package for broker/importer compliance.",
    pricingProFeat1: "Unlimited active suppliers & pilots",
    pricingProFeat2: "Automated WhatsApp & SMS reminders",
    pricingProFeat3: "Live Copernicus/Sentinel satellite audits",
    pricingProFeat4: "Generation of valid EU customs-proof packs",
    pricingProFeat5: "Priority email & chat support within 24h",
    pricingEnterpriseName: "Enterprise",
    pricingEnterprisePrice: "Custom",
    pricingEnterpriseDesc: "For global enterprises, cooperatives and heavy supply chains.",
    pricingEnterpriseFeat1: "Full API access & ERP software sync (SAP, etc.)",
    pricingEnterpriseFeat2: "Ultra-high resolution satellite feeds",
    pricingEnterpriseFeat3: "Dedicated regulatory legal advisory",
    pricingEnterpriseFeat4: "99.9% platform availability SLA",
    pricingEnterpriseFeat5: "Dedicated Account Success manager",
    pricingSelectBtn: "Start Free Audit",
    pricingContactBtn: "Contact sales team",
    gdprBannerTitle: "Respect for your Privacy & GDPR Compliance",
    gdprBannerText: "Traverdy uses essential technical cookies/local storage to power our platform operations (secure authentication, language preference, security tokens, and saving your privacy choices). No third-party marketing or tracking scripts are loaded.",
    gdprBtnAccept: "Accept & Continue",
    gdprBtnEssential: "Essential Only",
    gdprBtnRefuse: "Continue without accepting",
    gdprBtnLearnMore: "Learn More",
    gdprModalTitle: "Cookie Policy & GDPR Compliance Detail",
    gdprModalIntro: "In full compliance with the European Union's General Data Protection Regulation (GDPR - EU 2016/679), Traverdy is committed to absolute transparency, top-tier security, and complete sovereignty of your data.",
    gdprTableColCookie: "Cookie / Storage Key",
    gdprTableColType: "Type",
    gdprTableColPurpose: "Purpose & Use Cases",
    gdprTableColDuration: "Retention Period",
    gdprRow1Name: "traverdy_app_lang",
    gdprRow1Type: "Technical (Local)",
    gdprRow1Purpose: "Remembers your preferred navigation language (French or English) for instantaneous client-side UI rendering without server roundtrips.",
    gdprRow1Duration: "Persistent (until browser storage clearance)",
    gdprRow2Name: "traverdy_gdpr_consent",
    gdprRow2Type: "Technical (Local)",
    gdprRow2Purpose: "Stores your explicit consent decision (accepted/essential only) to prevent re-prompting on subsequent visits.",
    gdprRow2Duration: "1 year",
    gdprRow3Name: "demo_suppliers / demo_declarations",
    gdprRow3Type: "Technical & Sandbox State",
    gdprRow3Purpose: "Holds your interactive simulation edits (custom parcels, new suppliers, mock declarations) safely inside your sandbox session to avoid public leakages.",
    gdprRow3Duration: "Persistent or Session",
    gdprModalSec2Title: "Your Rights & Data Sovereignty Guarantees",
    gdprModalSec2Text: "All our real enterprise and customer databases are hosted within highly secured, sovereign European data centers (West Europe Firestore / Cloud Run). Your supply chain import files, GPS plot polygons, satellite evaluation history, and Due Diligence Statements (DDS) are encrypted both in transit and at rest, and are never shared or sold. You hold absolute rights to inspect, export, correct, or completely erase all your records at any time by contacting our data protection officer.",
    gdprModalClose: "Close & Save Options"
  }
};

interface PublicSupplierPortalProps {
  supplierRef: string;
  onSubmitted: (updated: Supplier) => void;
}

const PublicSupplierPortal: React.FC<PublicSupplierPortalProps> = ({ supplierRef, onSubmitted }) => {
  const [s, setS] = useState<Supplier | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [area, setArea] = useState('');
  const [date, setDate] = useState('');
  const [cert, setCert] = useState('');
  const [signature, setSignature] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('demo_suppliers');
    let list: Supplier[] = [];
    if (stored) {
      try {
        list = JSON.parse(stored);
      } catch (e) {
        list = INITIAL_DEMO_SUPPLIERS;
      }
    } else {
      list = INITIAL_DEMO_SUPPLIERS;
    }

    const found = list.find(x => x.ref.trim().toLowerCase() === supplierRef.trim().toLowerCase());
    if (found) {
      setS(found);
      setLat(found.lat || '');
      setLng(found.lng || '');
      setArea(found.area || '');
      setDate(found.date || '');
      setCert(found.cert || '');
    } else {
      // Auto mock standard supplier if ref not in local list, to allow demo of arbitrary refs
      const mockSup: Supplier = {
        id: 'mock-' + Math.random().toString(36).substring(2),
        name: 'Exploitation ' + supplierRef,
        coop: 'Coopérative Locale',
        product: 'Café',
        country: 'Honduras',
        region: 'Copán',
        qty: '12 tonnes',
        date: new Date().toISOString().split('T')[0],
        lat: '',
        lng: '',
        area: '8 hectares',
        cert: 'Rainforest Alliance',
        hsCode: '0901',
        type: 'individual',
        status: 'alert',
        ref: supplierRef,
        email: 'producer@traverdy.com',
        lang: 'Español',
        risk: 'standard',
        userId: 'demo_user_katia'
      };
      setS(mockSup);
      setArea('8 hectares');
      setDate(mockSup.date);
      setCert('Rainforest Alliance');
    }
  }, [supplierRef]);

  const t = useMemo(() => {
    if (!s) return PORTAL_LANG_DICTIONARY["Français"];
    return PORTAL_LANG_DICTIONARY[s.lang] || PORTAL_LANG_DICTIONARY["Français"];
  }, [s]);

  const handleDetectGPS = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toFixed(6));
          setLng(position.coords.longitude.toFixed(6));
          setIsLocating(false);
        },
        () => {
          setTimeout(() => {
            // High-fidelity natural farm coordinate mocking inside coffee zones
            const randomLat = (Math.random() * (-17.5 - (-19.5)) + (-19.5)).toFixed(6);
            const randomLng = (Math.random() * (-46.5 - (-48.5)) + (-48.5)).toFixed(6);
            setLat(randomLat);
            setLng(randomLng);
            setIsLocating(false);
          }, 1000);
        }
      );
    } else {
      const randomLat = (Math.random() * (-17.5 - (-19.5)) + (-19.5)).toFixed(6);
      const randomLng = (Math.random() * (-46.5 - (-48.5)) + (-48.5)).toFixed(6);
      setLat(randomLat);
      setLng(randomLng);
      setIsLocating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!s || !lat || !lng || !acceptedLegal || !signature) return;

    const updatedSupplier: Supplier = {
      ...s,
      lat,
      lng,
      area: area || '—',
      date: date || new Date().toISOString().split('T')[0],
      cert: cert || '—',
      status: 'ok',
    };

    onSubmitted(updatedSupplier);
    setHasSubmitted(true);
  };

  if (!s) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 pb-16">
      {/* Header Banner */}
      <header className="bg-emerald-950 text-emerald-100 py-8 px-6 text-center border-b border-white/10 shadow-lg">
        <div className="max-w-xl mx-auto flex items-center justify-center gap-3">
          <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#34d399]" />
          <span className="font-display font-bold text-xl text-white tracking-widest uppercase">TRAVERDY</span>
        </div>
        <p className="text-emerald-400/80 text-xs mt-1 uppercase tracking-widest font-mono font-bold">EUDR Compliance Network</p>
      </header>

      <div className="max-w-xl mx-auto px-6 mt-8">
        <AnimatePresence mode="wait">
          {!hasSubmitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-white rounded-3xl p-8 border border-stone-200/60 shadow-xl space-y-8"
            >
              <div>
                <h1 className="text-xl font-bold text-stone-950 flex items-center gap-2">
                  <Sparkles size={18} className="text-emerald-600" />
                  {t.title}
                </h1>
                <p className="text-xs text-stone-500 mt-1 font-medium">{t.subtitle}</p>
                
                <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 text-stone-800 text-xs leading-relaxed font-semibold">
                  <span>ℹ️</span>
                  <p>{t.hello} <strong className="text-stone-950">{s.name}</strong>, {t.instructions}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Parcel Reference Readonly */}
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/50 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400 block">Référence Dossier</span>
                    <span className="text-sm font-bold text-stone-800 font-mono tracking-tighter">{s.ref}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400 block">Produit / Code HS</span>
                    <span className="text-sm font-bold text-stone-800 uppercase">{s.product} ({s.hsCode})</span>
                  </div>
                </div>

                {/* GPS Coordinates Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-950 tracking-wide uppercase flex items-center gap-2">
                      <MapPin size={16} className="text-emerald-600" />
                      {t.gpsTitle}
                    </label>
                  </div>
                  <p className="text-xs text-stone-500 leading-relaxed">{t.gpsDesc}</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-stone-400 block">{t.manualLat}</span>
                      <input
                        type="text"
                        required
                        value={lat}
                        onChange={(e) => setLat(e.target.value)}
                        placeholder="-19.123456"
                        className="w-full p-4 rounded-xl border border-stone-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-bold bg-stone-50 transition-all font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-stone-400 block">{t.manualLng}</span>
                      <input
                        type="text"
                        required
                        value={lng}
                        onChange={(e) => setLng(e.target.value)}
                        placeholder="-48.654321"
                        className="w-full p-4 rounded-xl border border-stone-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-bold bg-stone-50 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDetectGPS}
                    disabled={isLocating}
                    className="w-full py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs rounded-xl hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                  >
                    {isLocating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
                        <span>Détection en cours...</span>
                      </>
                    ) : (
                      <>
                        <MapPin size={14} />
                        {t.detectLocation}
                      </>
                    )}
                  </button>
                </div>

                <hr className="border-stone-100" />

                {/* Area & Date Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-950 uppercase block">{t.areaTitle}</label>
                    <input
                      type="text"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="e.g. 15 hectares"
                      className="w-full p-4 rounded-xl border border-stone-200 focus:border-emerald-600 outline-none text-stone-800 text-sm font-medium bg-stone-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-950 uppercase block">{t.harvestDateTitle}</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full p-4 rounded-xl border border-stone-200 focus:border-emerald-600 outline-none text-stone-800 text-sm font-medium bg-stone-50"
                    />
                  </div>
                </div>

                {/* Certifications Label */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-950 uppercase block">{t.certificationTitle}</label>
                  <input
                    type="text"
                    value={cert}
                    onChange={(e) => setCert(e.target.value)}
                    placeholder="e.g. Rainforest Alliance, UTZ, etc."
                    className="w-full p-4 rounded-xl border border-stone-200 focus:border-emerald-600 outline-none text-stone-800 text-sm font-medium bg-stone-50"
                  />
                </div>

                <hr className="border-stone-100" />

                {/* Legal Conformity Switch */}
                <div className="space-y-4">
                  <div className="flex gap-3 items-start cursor-pointer group" onClick={() => setAcceptedLegal(!acceptedLegal)}>
                    <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${acceptedLegal ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'border-stone-300 bg-white group-hover:border-emerald-400'}`}>
                      {acceptedLegal && <Check size={14} />}
                    </div>
                    <span className="text-xs text-stone-600 font-semibold select-none leading-relaxed">
                      {t.legalText}
                    </span>
                  </div>

                  {/* Signature field */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-950 uppercase block">{t.signatureTitle}</label>
                    <input
                      type="text"
                      required
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                      placeholder="Votre nom complet"
                      className="w-full p-4 rounded-xl border border-stone-200 focus:border-emerald-600 outline-none text-stone-800 text-sm font-medium bg-stone-50 font-serif italic"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!lat || !lng || !acceptedLegal || !signature}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-xl hover:shadow-emerald-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Award size={18} />
                  {t.submitButton}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-10 border border-emerald-100 shadow-xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner shadow-emerald-200">
                <CheckCircle2 size={36} />
              </div>
              <div className="space-y-2">
                <h1 className="font-display text-2xl font-bold text-stone-950">{t.successTitle}</h1>
                <p className="text-sm text-stone-600 leading-relaxed font-medium">
                  {t.successDesc}
                </p>
              </div>

              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/50 max-w-sm mx-auto flex items-center gap-3">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shrink-0" />
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-widest font-mono">
                  Satellite Connection Stable
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const { user, profile, signIn, signInDemo, logout, authError } = useAuth();
  
  const initialSupplierRef = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    let val = params.get('ref') || params.get('fiche');
    if (!val && window.location.hash) {
      const idx = window.location.hash.indexOf('?');
      if (idx !== -1) {
        const hashParams = new URLSearchParams(window.location.hash.slice(idx));
        val = hashParams.get('ref') || hashParams.get('fiche');
      }
    }
    return val;
  }, []);

  const [activePortalRef, setActivePortalRef] = useState<string | null>(initialSupplierRef);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // GDPR Consent State
  const [gdprConsent, setGdprConsent] = useState<'accepted' | 'only_essential' | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('traverdy_gdpr_consent');
      if (saved === 'accepted' || saved === 'only_essential') return saved as 'accepted' | 'only_essential';
    }
    return null;
  });
  const [showGdprDetailModal, setShowGdprDetailModal] = useState(false);

  const saveGdprChoice = (choice: 'accepted' | 'only_essential') => {
    setGdprConsent(choice);
    localStorage.setItem('traverdy_gdpr_consent', choice);
  };
  
  const [appLang, setAppLang] = useState<'FR' | 'EN'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('traverdy_app_lang');
      if (saved === 'FR' || saved === 'EN') return saved;
    }
    return 'FR';
  });

  const changeAppLang = (lang: 'FR' | 'EN') => {
    setAppLang(lang);
    localStorage.setItem('traverdy_app_lang', lang);
  };

  const d = LANDING_DICTS[appLang];

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeFilter, setActiveFilter] = useState<Status | 'all'>('all');
  const [currentView, setCurrentView] = useState<'dashboard' | 'suppliers' | 'declarations' | 'pitch'>('dashboard');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'manual' | 'registry'>('manual');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<'statement' | 'proof_pack'>('statement');
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [notification, setNotification] = useState<{ icon: string; msg: string } | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [mockMobilePreview, setMockMobilePreview] = useState(false);
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');

  const trialDaysRemaining = useMemo(() => {
    if (!profile?.createdAt) return 14;
    const created = profile.createdAt.toDate ? profile.createdAt.toDate() : new Date(profile.createdAt);
    const now = new Date();
    const diff = now.getTime() - created.getTime();
    const daysPassed = Math.floor(diff / (1000 * 60 * 60 * 24));
    return Math.max(0, 14 - daysPassed);
  }, [profile]);

  // Form State for new supplier
  const [newSupplier, setNewSupplier] = useState<{
    name: string;
    country: string;
    email: string;
    product: string;
    type: 'individual' | 'cooperative';
  }>({
    name: '',
    country: 'Brésil',
    email: '',
    product: 'Café',
    type: 'individual'
  });

  useEffect(() => {
    if (!user) return;

    if ('isDemo' in user && user.isDemo) {
      const stored = localStorage.getItem('demo_suppliers');
      if (stored) {
        setSuppliers(JSON.parse(stored));
      } else {
        const initial = INITIAL_DEMO_SUPPLIERS.map(item => ({ ...item, userId: user.uid }));
        localStorage.setItem('demo_suppliers', JSON.stringify(initial));
        setSuppliers(initial);
      }
      return;
    }

    const q = query(
      collection(db, 'suppliers'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Supplier[];
      setSuppliers(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'suppliers');
    });

    return () => unsubscribe();
  }, [user]);

  const stats = useMemo(() => {
    const total = suppliers.length;
    const conformes = suppliers.filter(s => s.status === 'ok').length;
    const pending = suppliers.filter(s => s.status === 'pending').length;
    const missing = suppliers.filter(s => s.status === 'alert').length;
    const score = total > 0 ? Math.round((conformes / total) * 100) : 0;
    return { total, conformes, pending, missing, score };
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    if (activeFilter === 'all') return suppliers;
    return suppliers.filter(s => s.status === activeFilter);
  }, [suppliers, activeFilter]);

  const selectedSupplier = useMemo(() => 
    suppliers.find(s => s.id === selectedSupplierId) || null
  , [suppliers, selectedSupplierId]);

  useEffect(() => {
    if (selectedSupplier) {
      setEditLat(selectedSupplier.lat || '');
      setEditLng(selectedSupplier.lng || '');
    } else {
      setEditLat('');
      setEditLng('');
    }
  }, [selectedSupplier]);

  const showNotif = (icon: string, msg: string) => {
    setNotification({ icon, msg });
    setTimeout(() => setNotification(null), 3500);
  };

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [satelliteReport, setSatelliteReport] = useState<{ safe: boolean; confidence: number; report: string } | null>(null);

  const handleSatelliteAudit = async () => {
    if (!selectedSupplier || !selectedSupplier.lat) return;
    setIsAnalyzing(true);
    setSatelliteReport(null);
    try {
      const response = await fetch('/api/satellite/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: selectedSupplier.lat, lng: selectedSupplier.lng })
      });
      const data = await response.json();
      setSatelliteReport(data);
      showNotif('🛰️', "Audit satellite terminé.");
    } catch (error) {
      console.error(error);
      showNotif('❌', "Erreur lors de l'audit satellite.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveGPS = async () => {
    if (!selectedSupplier) return;
    const newStatus = selectedSupplier.status === 'alert' || selectedSupplier.status === 'new' ? 'pending' : selectedSupplier.status;

    if ('isDemo' in user && user.isDemo) {
      const updated = suppliers.map(s => s.id === selectedSupplier.id ? {
        ...s,
        lat: editLat,
        lng: editLng,
        status: newStatus
      } : s);
      setSuppliers(updated);
      localStorage.setItem('demo_suppliers', JSON.stringify(updated));
      showNotif('📍', "Coordonnées GPS enregistrées (Démo).");
      return;
    }

    try {
      const supplierRef = doc(db, 'suppliers', selectedSupplier.id);
      await updateDoc(supplierRef, {
        lat: editLat,
        lng: editLng,
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      showNotif('📍', "Coordonnées GPS enregistrées.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `suppliers/${selectedSupplier.id}`);
    }
  };

  const [isSigning, setIsSigning] = useState(false);

  const handleSign = async () => {
    if (!selectedSupplier) return;
    setIsSigning(true);
    try {
      const response = await fetch('/api/docusign/create-envelope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierName: selectedSupplier.name, ref: selectedSupplier.ref })
      });
      const data = await response.json();
      // On simule l'ouverture de l'URL de signature DocuSign
      window.open(data.signingUrl, '_blank');
      showNotif('✍️', "Enveloppe de signature créée.");
      setIsPreviewOpen(false);
    } catch (error) {
      console.error(error);
      showNotif('❌', "Erreur DocuSign.");
    } finally {
      setIsSigning(false);
    }
  };

  const handleAddFromExporter = async (exporter: OfficialExporter) => {
    if (!user) return;
    try {
      const hsMatch = OFFICIAL_HS_CODES.find(h => h.category === exporter.product);
      const hsCode = hsMatch ? hsMatch.code : '0901';
      const risk = COUNTRY_RISK_BENCHMARK[exporter.country] || 'standard';
      const currentYear = new Date().getFullYear();
      const ref = `${hsCode}-${exporter.country.substring(0,2).toUpperCase()}-${currentYear}-${Math.floor(100 + Math.random() * 900)}`;
      
      const newRecord: Supplier = {
        id: 'demo-' + Date.now(),
        name: exporter.name,
        country: exporter.country,
        product: exporter.product,
        email: `contact@${exporter.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.com`,
        coop: exporter.type === 'Coopérative' ? exporter.name : "N/A",
        region: "—",
        qty: "—",
        date: "",
        lat: "",
        lng: "",
        area: "",
        cert: "Vérification en cours",
        hsCode,
        type: exporter.type === 'Coopérative' ? 'cooperative' : 'individual',
        status: "new",
        ref,
        lang: exporter.country === 'Indonésie' ? 'Bahasa Indonesia' : (exporter.country === 'Brésil' ? 'Português' : 'Français'),
        risk,
        userId: user.uid,
      };

      if ('isDemo' in user && user.isDemo) {
        const updated = [newRecord, ...suppliers];
        setSuppliers(updated);
        localStorage.setItem('demo_suppliers', JSON.stringify(updated));
        setIsModalOpen(false);
        showNotif('🏛️', `${exporter.name} importé en mode Démo.`);
        return;
      }

      await addDoc(collection(db, 'suppliers'), {
        ...newRecord,
        id: undefined, // let firestore assign id
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      setIsModalOpen(false);
      showNotif('🏛️', `${exporter.name} importé depuis le registre officiel.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'suppliers');
    }
  };

  const handleAddSupplier = async () => {
    if (!user) return;
    try {
      const hsMatch = OFFICIAL_HS_CODES.find(h => h.category === newSupplier.product);
      const hsCode = hsMatch ? hsMatch.code : '0901';
      const risk = COUNTRY_RISK_BENCHMARK[newSupplier.country] || 'standard';
      const currentYear = new Date().getFullYear();
      const ref = `${hsCode}-${newSupplier.country.substring(0,2).toUpperCase()}-${currentYear}-${Math.floor(100 + Math.random() * 900)}`;
      
      const newRecord: Supplier = {
        id: 'demo-' + Date.now(),
        ...newSupplier,
        coop: "En attente",
        region: "—",
        qty: "—",
        date: "",
        lat: "",
        lng: "",
        area: "",
        cert: "",
        hsCode,
        ref,
        lang: "Português",
        risk,
        userId: user.uid,
      };

      if ('isDemo' in user && user.isDemo) {
        const updated = [newRecord, ...suppliers];
        setSuppliers(updated);
        localStorage.setItem('demo_suppliers', JSON.stringify(updated));
        setIsModalOpen(false);
        setNewSupplier({ name: '', country: 'Brésil', email: '', product: 'Café', type: 'individual' });
        showNotif('📨', "Fournisseur ajouté en mode Démo.");
        return;
      }

      await addDoc(collection(db, 'suppliers'), {
        ...newRecord,
        id: undefined, // let firestore assign id
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      setIsModalOpen(false);
      setNewSupplier({ name: '', country: 'Brésil', email: '', product: 'Café', type: 'individual' });
      showNotif('📨', "Fournisseur ajouté — Données EUDR pré-remplies.");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'suppliers');
    }
  };

  const validateSupplier = async (id: string) => {
    if ('isDemo' in user && user.isDemo) {
      const updated = suppliers.map(s => s.id === id ? { ...s, status: 'ok' as Status } : s);
      setSuppliers(updated);
      localStorage.setItem('demo_suppliers', JSON.stringify(updated));
      setSelectedSupplierId(null);
      showNotif('✓', "Dossier marqué comme conforme (Démo).");
      return;
    }

    try {
      const supplierRef = doc(db, 'suppliers', id);
      await updateDoc(supplierRef, { 
        status: 'ok',
        updatedAt: serverTimestamp()
      });
      setSelectedSupplierId(null);
      showNotif('✓', "Dossier marqué comme conforme.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `suppliers/${id}`);
    }
  };

  const deleteSupplier = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce fournisseur ? Cette action est irréversible.")) return;

    if ('isDemo' in user && user.isDemo) {
      const updated = suppliers.filter(s => s.id !== id);
      setSuppliers(updated);
      localStorage.setItem('demo_suppliers', JSON.stringify(updated));
      setSelectedSupplierId(null);
      showNotif('🗑️', "Fournisseur supprimé en mode Démo.");
      return;
    }

    try {
      await deleteDoc(doc(db, 'suppliers', id));
      setSelectedSupplierId(null);
      showNotif('🗑️', "Fournisseur supprimé définitivement.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `suppliers/${id}`);
    }
  };

  const handleExportCSV = () => {
    if (suppliers.length === 0) return;
    
    const headers = ["ID", "Nom", "Pays", "Produit", "Statut", "Risque", "Latitude", "Longitude"];
    const rows = suppliers.map(s => [
      s.ref,
      s.name,
      s.country,
      s.product,
      s.status,
      s.risk,
      s.lat || "N/A",
      s.lng || "N/A"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(field => `"${field}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `suppliers_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotif('📊', "Export CSV généré.");
  };

  if (activePortalRef) {
    return (
      <div className="relative">
        <button
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.delete('ref');
            url.searchParams.delete('fiche');
            window.history.replaceState({}, '', url.toString());
            setActivePortalRef(null);
          }}
          className="fixed top-4 left-4 z-50 px-4 py-2.5 bg-slate-900 border border-slate-800 text-white hover:bg-slate-800 rounded-full font-bold text-xs flex items-center gap-2 shadow-xl hover:scale-105 active:scale-95 transition-all"
        >
          <span>←</span> Retour à l'administration
        </button>
        <PublicSupplierPortal 
          supplierRef={activePortalRef} 
          onSubmitted={(updated) => {
            const stored = localStorage.getItem('demo_suppliers');
            let list: Supplier[] = [];
            if (stored) {
              try {
                list = JSON.parse(stored);
              } catch (e) {
                list = INITIAL_DEMO_SUPPLIERS;
              }
            } else {
              list = INITIAL_DEMO_SUPPLIERS;
            }
            const newList = list.map(item => item.ref === updated.ref ? { ...item, ...updated } : item);
            localStorage.setItem('demo_suppliers', JSON.stringify(newList));
            setSuppliers(newList);
          }}
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-emerald-500/30 font-sans flex flex-col relative overflow-x-hidden">
        {/* Navigation Bar */}
        <header className="sticky top-0 bg-white/70 backdrop-blur-md border-b border-slate-200/60 h-16 px-6 lg:px-12 flex items-center justify-between z-40 transition-all">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-[#1db954] rounded-full shadow-[0_0_8px_rgba(29,185,84,0.6)]" />
            <span className="font-display font-black text-2xl tracking-tight text-slate-900">Traverdy</span>
            <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">{d.badgeEudr}</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-[#1db954] transition-colors font-medium">{d.navFeatures}</a>
            <a href="#compliance" className="hover:text-[#1db954] transition-colors font-medium">{d.navCompliance}</a>
            <a href="#demo-portal" className="hover:text-[#1db954] transition-colors font-medium">{d.navPortal}</a>
            <a href="#pricing" className="hover:text-[#1db954] transition-colors font-medium">{d.navPricing}</a>
          </nav>

          <div className="flex items-center gap-3">
            {/* Language Selection Toggle */}
            <div className="flex bg-slate-100 rounded-full p-0.5 border border-slate-200 mr-1 shrink-0">
              <button
                onClick={() => changeAppLang('FR')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  appLang === 'FR' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>🇫🇷</span> <span className="hidden sm:inline">FR</span>
              </button>
              <button
                onClick={() => changeAppLang('EN')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  appLang === 'EN' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>🇬🇧</span> <span className="hidden sm:inline">EN</span>
              </button>
            </div>

            <button
              onClick={() => signInDemo()}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200 transition-all cursor-pointer"
            >
              {d.sandboxBtn}
            </button>
            <button 
              onClick={() => setShowLoginModal(true)}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-full flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <LogIn size={14} />
              {d.loginBtn}
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative py-16 lg:py-24 px-6 lg:px-12 flex flex-col items-center text-center bg-gradient-to-b from-white via-slate-50 to-white overflow-hidden">
          {/* Subtle glowing backgrounds */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-100/30 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 max-w-4xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              <span>🇪🇺</span> {d.tagline}
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-sans tracking-tight font-extrabold text-slate-900 leading-[1.1]">
              {d.heroTitle}
            </h1>

            <p className="max-w-2xl mx-auto text-base md:text-lg text-slate-500 font-medium leading-relaxed">
              {d.heroSubtitle}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button 
                onClick={() => signInDemo()}
                className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl hover:shadow-emerald-200 hover:-translate-y-0.5 active:translate-y-0 transition-all text-sm cursor-pointer"
              >
                <Sparkles size={18} />
                {d.demoBtn}
              </button>
              <button 
                onClick={() => setShowLoginModal(true)}
                className="w-full sm:w-auto px-8 py-4 bg-slate-950 text-white border border-slate-800 hover:bg-slate-800 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all text-sm cursor-pointer"
              >
                {d.createProBtn}
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="pt-3 text-[11px] text-slate-400 flex items-center justify-center gap-4 font-semibold">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-500" />
                {d.bullet1}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-500" />
                {d.bullet2}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-500" />
                {d.bullet3}
              </span>
            </div>
          </div>

          {/* Interactive Screen Preview representing Traverdy UI */}
          <div className="mt-16 relative z-10 w-full max-w-5xl rounded-3xl border border-slate-200/80 shadow-2xl overflow-hidden bg-white p-2">
            <div className="bg-slate-900 text-slate-400 p-4 rounded-2xl">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-[#1db954] rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-white tracking-tight">{d.previewTitle}</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold uppercase">{d.previewStatus}</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-left">
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">{d.previewCompliance}</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-white">92.4%</span>
                    <span className="text-[10px] text-[#1db954] font-bold">{d.previewCompliant}</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div className="bg-[#1db954] h-full rounded-full" style={{ width: '92%' }} />
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">{d.previewAudited}</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-white">48 parcelles</span>
                    <span className="text-[10px] text-emerald-400 font-bold">✓ RGPD Ok</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">{d.previewAuditedSub}</p>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">{d.previewSatellite}</span>
                  <p className="text-xs text-slate-200 mt-1 font-bold">{d.previewNoRisk}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-[9px] bg-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                    {d.previewSentinel}
                  </span>
                </div>
              </div>

              {/* Graphic Mockup Area */}
              <div className="mt-4 bg-slate-950/80 rounded-xl p-6 border border-white/5 text-center min-h-[200px] flex flex-col justify-center items-center">
                <Globe size={40} className="text-emerald-500/60 animate-pulse" />
                <span className="text-xs text-slate-300 font-bold tracking-tight mt-4">
                  {d.previewMapTitle}
                </span>
                <p className="text-[10px] text-slate-500 max-w-md mt-1">
                  {d.previewMapDesc}
                </p>
                <div className="mt-4 flex gap-2">
                  <span className="px-3 py-1 bg-white/5 rounded text-[10px] font-mono border border-white/5">0.0528° N, 32.5811° E</span>
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-mono border border-emerald-500/10">DDS_COMPLIANT_OK</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section id="features" className="py-20 bg-white px-6 lg:px-12 border-t border-slate-100">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <span className="text-xs font-black text-emerald-600 uppercase tracking-widest block">{d.featuresTitleBadge}</span>
              <h2 className="text-3xl md:text-4xl font-sans font-bold text-slate-900 tracking-tight">
                {d.featuresTitle}
              </h2>
              <p className="text-sm md:text-base text-slate-500 max-w-2xl mx-auto font-medium">
                {d.featuresDesc}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/50 space-y-4 hover:shadow-xl hover:bg-slate-50/50 transition-all">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                  <MapPin size={20} />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">{d.feature1Title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  {d.feature1Desc}
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/50 space-y-4 hover:shadow-xl hover:bg-slate-50/50 transition-all">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                  <Globe size={20} />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">{d.feature2Title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  {d.feature2Desc}
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/50 space-y-4 hover:shadow-xl hover:bg-slate-50/50 transition-all">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                  <Send size={20} />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">{d.feature3Title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  {d.feature3Desc}
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/50 space-y-4 hover:shadow-xl hover:bg-slate-50/50 transition-all">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                  <FileText size={20} />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">{d.feature4Title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  {d.feature4Desc}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section Réglementation EUDR */}
        <section id="compliance" className="py-20 bg-slate-50 px-6 lg:px-12 border-t border-slate-200/50">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6">
              <span className="text-xs font-black text-emerald-600 uppercase tracking-widest block">{d.complianceBadge}</span>
              <h2 className="text-3xl font-sans font-bold text-slate-900 tracking-tight">
                {d.complianceTitle}
              </h2>
              <div className="space-y-4 text-xs md:text-sm text-slate-600 font-semibold">
                <p>
                  {d.complianceDesc1}
                </p>
                <p className="font-extrabold text-slate-900">
                  {d.complianceDesc2}
                </p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-start gap-4">
                <Award size={24} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-emerald-950 text-sm">{d.complianceGuaranteeTitle}</h4>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    {d.complianceGuaranteeDesc}
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full md:w-80 bg-white border border-slate-200 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">{d.complianceMaterialsTitle}</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/50">
                  <span className="text-xs font-bold font-mono text-slate-700">{d.complianceMaterialsCoffee}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{d.complianceMaterialsActive}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/50">
                  <span className="text-xs font-bold font-mono text-slate-700">{d.complianceMaterialsCocoa}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{d.complianceMaterialsActive}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/50">
                  <span className="text-xs font-bold font-mono text-slate-700">{d.complianceMaterialsWood}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">v2</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/50">
                  <span className="text-xs font-bold font-mono text-slate-700">{d.complianceMaterialsRubber}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">v2</span>
                </div>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => signInDemo()}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                >
                  {d.auditBtn}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section Interactive Portail Producteur */}
        <section id="demo-portal" className="py-20 bg-white px-6 lg:px-12 border-t border-slate-200/50">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-black text-emerald-600 uppercase tracking-widest block">{d.portalDemoBadge}</span>
              <h2 className="text-3xl font-sans font-bold text-slate-900 tracking-tight">
                {d.portalDemoTitle}
              </h2>
              <p className="text-sm text-slate-500 max-w-xl mx-auto font-semibold">
                {d.portalDemoDesc}
              </p>
            </div>

            <div className="max-w-md mx-auto bg-slate-50 p-6 rounded-3xl border border-slate-200">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const inputRef = formData.get('quickRef') as string;
                  if (inputRef && inputRef.trim()) {
                    setActivePortalRef(inputRef.trim().toUpperCase());
                  }
                }} 
                className="flex gap-2"
              >
                <input
                  name="quickRef"
                  type="text"
                  placeholder={d.portalDemoInputPlaceholder}
                  required
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold font-mono text-slate-800 uppercase focus:outline-none focus:border-emerald-600 transition-all font-semibold"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {d.portalDemoSubmit}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Section Tarifs / Pricing */}
        <section id="pricing" className="py-20 bg-slate-50 px-6 lg:px-12 border-t border-slate-200/50">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <span className="text-xs font-black text-emerald-600 uppercase tracking-widest block">{d.pricingTitleBadge}</span>
              <h2 className="text-3xl md:text-4xl font-sans font-bold text-slate-900 tracking-tight">
                {d.pricingTitle}
              </h2>
              <p className="text-sm md:text-base text-slate-500 max-w-2xl mx-auto font-medium">
                {d.pricingSubtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
              {/* Sandbox Card */}
              <div className="bg-white rounded-3xl p-8 border border-slate-200/60 shadow-sm flex flex-col justify-between space-y-6 relative hover:shadow-md transition-all">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">{d.pricingFreeName}</span>
                    <h3 className="text-2xl font-black text-slate-900 pt-2">{d.pricingFreeName}</h3>
                    <p className="text-xs text-slate-500 font-semibold">{d.pricingFreeDesc}</p>
                  </div>

                  <div className="flex items-baseline gap-1 py-2">
                    <span className="text-4xl font-black text-slate-900">{d.pricingFreePrice}</span>
                    <span className="text-xs text-slate-400 font-semibold">/ {d.pricingPeriod}</span>
                  </div>

                  <div className="border-t border-slate-100 my-4" />

                  <ul className="space-y-3">
                    <li className="flex items-start gap-2.5 text-xs text-slate-600 font-semibold">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{d.pricingFreeFeat1}</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-xs text-slate-600 font-semibold">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{d.pricingFreeFeat2}</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-xs text-slate-600 font-semibold">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{d.pricingFreeFeat3}</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-xs text-slate-600 font-semibold">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{d.pricingFreeFeat4}</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-xs text-slate-500 font-semibold">
                      <Check size={14} className="text-slate-300 shrink-0 mt-0.5" />
                      <span className="line-through">{d.pricingFreeFeat5}</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => signInDemo()}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
                  >
                    {d.pricingSelectBtn}
                  </button>
                </div>
              </div>

              {/* Pro Card (Main highlight) */}
              <div className="bg-slate-950 text-white rounded-3xl p-8 border-2 border-emerald-500/55 shadow-xl flex flex-col justify-between space-y-6 relative hover:scale-[1.02] transition-colors duration-200">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 text-[9px] font-black px-4 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-lg">
                  <Sparkles size={10} className="fill-slate-950" />
                  <span>Popular</span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] bg-emerald-500/25 text-emerald-400 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">{d.pricingProName}</span>
                    <h3 className="text-2xl font-black text-white pt-2">{d.pricingProName}</h3>
                    <p className="text-xs text-slate-400 font-semibold">{d.pricingProDesc}</p>
                  </div>

                  <div className="flex items-baseline gap-1 py-2">
                    <span className="text-4xl font-black text-white">{d.pricingProPrice}</span>
                    <span className="text-xs text-slate-500 font-semibold">/ {d.pricingPeriod}</span>
                  </div>

                  <div className="border-t border-white/5 my-4" />

                  <ul className="space-y-3">
                    <li className="flex items-start gap-2.5 text-xs text-slate-300 font-semibold">
                      <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>{d.pricingProFeat1}</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-xs text-slate-300 font-semibold">
                      <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>{d.pricingProFeat2}</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-xs text-slate-300 font-semibold">
                      <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>{d.pricingProFeat3}</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-xs text-slate-300 font-semibold">
                      <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>{d.pricingProFeat4}</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-xs text-slate-300 font-semibold">
                      <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>{d.pricingProFeat5}</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md hover:shadow-emerald-900/40 cursor-pointer text-center animate-pulse"
                  >
                    {d.createProBtn}
                  </button>
                </div>
              </div>

              {/* Enterprise Card */}
              <div className="bg-white rounded-3xl p-8 border border-slate-200/60 shadow-sm flex flex-col justify-between space-y-6 relative hover:shadow-md transition-all">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">{d.pricingEnterpriseName}</span>
                    <h3 className="text-2xl font-black text-slate-900 pt-2">{d.pricingEnterpriseName}</h3>
                    <p className="text-xs text-slate-500 font-semibold">{d.pricingEnterpriseDesc}</p>
                  </div>

                  <div className="flex items-baseline gap-1 py-2">
                    <span className="text-4xl font-black text-slate-900">{d.pricingEnterprisePrice}</span>
                  </div>

                  <div className="border-t border-slate-100 my-4" />

                  <ul className="space-y-3">
                    <li className="flex items-start gap-2.5 text-xs text-slate-600 font-semibold">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{d.pricingEnterpriseFeat1}</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-xs text-slate-600 font-semibold">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{d.pricingEnterpriseFeat2}</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-xs text-slate-600 font-semibold">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{d.pricingEnterpriseFeat3}</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-xs text-slate-600 font-semibold">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{d.pricingEnterpriseFeat4}</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-xs text-slate-600 font-semibold">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{d.pricingEnterpriseFeat5}</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
                  >
                    {d.pricingContactBtn}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-slate-900 text-slate-400 py-12 px-6 lg:px-12 mt-auto border-t border-white/5">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-[#1db954] rounded-full" />
              <span className="font-display font-bold text-white text-lg tracking-tight">Traverdy</span>
              <span className="text-[10px] text-slate-500">· Version {COMPLIANCE_METADATA.version}</span>
            </div>
            
            <p className="text-[11px] text-slate-500 text-center md:text-right max-w-md leading-relaxed">
              {d.footerDesc}
            </p>
          </div>
          <div className="max-w-6xl mx-auto mt-6 pt-6 border-t border-white/5 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600">
              &copy; {new Date().getFullYear()} Traverdy SAS. {d.footerCopyright}
            </p>
            <div className="flex items-center gap-4 text-xs">
              <button 
                type="button"
                onClick={() => setShowGdprDetailModal(true)} 
                className="text-slate-500 hover:text-emerald-400 font-semibold transition-colors cursor-pointer"
              >
                {d.gdprBtnLearnMore} (RGPD)
              </button>
              {gdprConsent && (
                <button 
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('traverdy_gdpr_consent');
                    setGdprConsent(null);
                  }} 
                  className="text-slate-600 hover:text-red-400 font-semibold transition-colors cursor-pointer"
                >
                  {appLang === 'FR' ? "Réinitialiser les cookies" : "Reset Cookies"}
                </button>
              )}
            </div>
          </div>
        </footer>

        {/* Login Modal */}
        <AnimatePresence>
          {showLoginModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowLoginModal(false)}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              />

              {/* Modal Box */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative z-10 w-full max-w-md bg-white rounded-3xl p-8 md:p-10 shadow-2xl border border-slate-100 space-y-6"
              >
                {/* Header with Close */}
                <div className="flex justify-between items-start">
                  <div className="inline-flex items-center gap-2">
                    <div className="w-3.5 h-3.5 bg-[#1db954] rounded-full" />
                    <span className="font-display font-black text-xl tracking-tight text-slate-900">Traverdy</span>
                  </div>
                  <button 
                    onClick={() => setShowLoginModal(false)}
                    className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-full text-xs font-bold transition-all cursor-pointer"
                  >
                    {d.modalClose}
                  </button>
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-slate-950">{d.modalTitle}</h2>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    {d.modalSubtitle}
                  </p>
                </div>

                {authError && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} 
                    animate={{ height: "auto", opacity: 1 }}
                    className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-700 space-y-2"
                  >
                    <div className="flex gap-2 items-start font-bold">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>Problème de Pop-up ou de Configuration</span>
                    </div>
                    <p className="leading-relaxed font-semibold">{authError}</p>
                  </motion.div>
                )}

                <div className="space-y-3 pt-2">
                  <button 
                    onClick={() => {
                      signIn();
                    }}
                    type="button"
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-md cursor-pointer"
                  >
                    <LogIn size={20} />
                    {d.modalGoogleBtn}
                  </button>

                  <button 
                    onClick={() => {
                      signInDemo();
                      setShowLoginModal(false);
                    }}
                    type="button"
                    className="w-full py-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-100/70 transition-all cursor-pointer"
                  >
                    <Check size={18} />
                    {d.modalSandboxBtn}
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[10px] text-slate-500 space-y-1">
                  <p className="font-bold text-slate-700">{d.modalTipTitle}</p>
                  <p className="leading-relaxed font-semibold">
                    {d.modalTipDesc}
                  </p>
                </div>

                <p className="text-[10px] text-center text-slate-400 leading-relaxed font-medium">
                  {d.modalLegal}
                </p>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Cookie Consent Banner */}
        <AnimatePresence>
          {!gdprConsent && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:max-w-md bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 shadow-2xl z-50 flex flex-col space-y-4 font-sans text-left"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl shrink-0">
                    <Shield size={20} />
                  </div>
                  <h4 className="text-sm font-black tracking-tight self-center">{d.gdprBannerTitle}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => saveGdprChoice('only_essential')}
                  className="text-[11px] text-slate-400 hover:text-emerald-400 underline font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 bg-transparent border-none mt-1"
                >
                  {d.gdprBtnRefuse} ✕
                </button>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {d.gdprBannerText}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => saveGdprChoice('accepted')}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition-all cursor-pointer text-center"
                >
                  {d.gdprBtnAccept}
                </button>
                <button
                  type="button"
                  onClick={() => saveGdprChoice('only_essential')}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
                >
                  {d.gdprBtnEssential}
                </button>
              </div>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowGdprDetailModal(true)}
                  className="text-[11px] text-slate-400 hover:text-slate-300 underline font-semibold cursor-pointer transition-colors"
                >
                  {d.gdprBtnLearnMore} (RGPD)
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Detailed GDPR / Privacy Modal */}
        <AnimatePresence>
          {showGdprDetailModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowGdprDetailModal(false)}
                className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative z-10 w-full max-w-2xl bg-white rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] text-slate-800 font-sans"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                      <Shield size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 leading-tight">{d.gdprModalTitle}</h3>
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest block w-fit mt-1">Sovereign Compliance</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGdprDetailModal(false)}
                    className="p-1 px-2.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 font-black text-xs cursor-pointer transition-all"
                  >
                    ✕
                  </button>
                </div>

                {/* Content with Scroll */}
                <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-6">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {d.gdprModalIntro}
                  </p>

                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                      <Lock size={12} className="text-emerald-500" />
                      {appLang === 'FR' ? "Détail de notre utilisation" : "Operational Storage Details"}
                    </h4>

                    <div className="border border-slate-150 rounded-2xl overflow-hidden text-[11px]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-150">
                            <th className="p-3 font-semibold">{d.gdprTableColCookie}</th>
                            <th className="p-3 font-semibold">{d.gdprTableColType}</th>
                            <th className="p-3 font-semibold">{d.gdprTableColPurpose}</th>
                            <th className="p-3 font-semibold">{d.gdprTableColDuration}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          <tr className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-bold text-[#1db954]">{d.gdprRow1Name}</td>
                            <td className="p-3 font-medium text-slate-500">{d.gdprRow1Type}</td>
                            <td className="p-3 leading-relaxed text-slate-500">{d.gdprRow1Purpose}</td>
                            <td className="p-3 font-medium text-slate-500">{d.gdprRow1Duration}</td>
                          </tr>
                          <tr className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-bold text-[#1db954]">{d.gdprRow2Name}</td>
                            <td className="p-3 font-medium text-slate-500">{d.gdprRow2Type}</td>
                            <td className="p-3 leading-relaxed text-slate-500">{d.gdprRow2Purpose}</td>
                            <td className="p-3 font-medium text-slate-500">{d.gdprRow2Duration}</td>
                          </tr>
                          <tr className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-bold text-[#1db954]">{d.gdprRow3Name}</td>
                            <td className="p-3 font-medium text-slate-500">{d.gdprRow3Type}</td>
                            <td className="p-3 leading-relaxed text-slate-500">{d.gdprRow3Purpose}</td>
                            <td className="p-3 text-slate-500 font-medium">{d.gdprRow3Duration}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Shield size={12} className="text-emerald-500" />
                      {d.gdprModalSec2Title}
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed text-slate-500">
                      {d.gdprModalSec2Text}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!gdprConsent) {
                        saveGdprChoice('accepted');
                      }
                      setShowGdprDetailModal(false);
                    }}
                    className="px-6 py-2.5 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-slate-300 transition-all cursor-pointer"
                  >
                    {d.gdprModalClose}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar 
        onLogout={logout} 
        onOpenBilling={() => setIsBillingOpen(true)} 
        trialDaysRemaining={trialDaysRemaining} 
        currentView={currentView}
        setCurrentView={setCurrentView}
        appLang={appLang}
        onChangeAppLang={changeAppLang}
      />

      <main className="pl-64 min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between z-40">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold tracking-tight">
              {currentView === 'pitch' ? 'Simulateur d\'Impact & Calculateur de ROI' :
               currentView === 'dashboard' ? 'Vue d\'ensemble' : 
               currentView === 'suppliers' ? 'Gestion des Fournisseurs' : 'Gestion des Déclarations'}
            </h1>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-600 border border-emerald-100 uppercase tracking-tight">Mode Production</span>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleExportCSV}
              className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <Download size={16} />
              Exporter CSV
            </button>
            {currentView === 'suppliers' && (
              <button 
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 rounded-lg bg-[#1db954] text-white text-sm font-semibold hover:bg-[#1db954]/90 transition-colors flex items-center gap-2 shadow-lg shadow-emerald-100"
              >
                <Plus size={18} />
                Ajouter fournisseur
              </button>
            )}
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto space-y-8">
          {currentView === 'pitch' ? (
            <RiskRoiCalculator 
              suppliers={suppliers} 
              setSuppliers={setSuppliers} 
              setCurrentView={setCurrentView}
              setActivePortalRef={setActivePortalRef}
              showNotif={showNotif}
            />
          ) : currentView === 'dashboard' ? (
            <DashboardOverview stats={stats} suppliers={suppliers} />
          ) : currentView === 'declarations' ? (
            <ComplianceDeclarations suppliers={suppliers} onNotif={showNotif} />
          ) : (
            <>
              {/* Warning Banner */}
              {stats.missing > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-4 items-center">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-full">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="text-sm text-amber-900">
                    <span className="font-bold">{stats.missing} dossier{stats.missing > 1 ? 's' : ''} action requise.</span> Données GPS manquantes pour certains fournisseurs stratégiques.
                    <span className="ml-2 opacity-75 font-medium tracking-tight">Deadline EUDR : 30 déc. 2026.</span>
                  </div>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <KpiCard icon={<Globe size={20} />} value={stats.total} label="Fournisseurs" sub="Portefeuille actif" colorClass="text-blue-600" />
                <KpiCard icon={<CheckCircle2 size={20} />} value={stats.conformes} label="Conformes" sub={`${stats.total > 0 ? Math.round(stats.conformes/stats.total*100) : 0}% du total`} colorClass="text-emerald-600" />
                <KpiCard icon={<ClipboardCheck size={20} />} value={`${stats.score}%`} label="Score Global" sub="Indice de conformité" colorClass="text-emerald-500" />
                <KpiCard icon={<Mail size={20} />} value={stats.pending} label="En attente" sub="Dernières relances" colorClass="text-amber-600" />
                <KpiCard icon={<AlertTriangle size={20} />} value={stats.missing} label="Actions" sub="Incomplets" colorClass="text-red-600" />
              </div>

              {/* Progress Section */}
              <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Progression Conformité</h3>
                <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${stats.total > 0 ? (stats.conformes / stats.total) * 100 : 0}%` }}
                     className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-emerald-600"
                   />
                </div>
                <div className="flex justify-between mt-3 text-xs font-bold">
                  <span className="text-slate-400">0%</span>
                  <span className="text-emerald-600">{stats.conformes} sur {stats.total} conformes</span>
                  <span className="text-slate-400">100%</span>
                </div>
              </section>

              {/* Suppliers Table Section */}
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-xl font-bold font-display tracking-tight">Gestion des importations</h2>
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    {(['all', 'ok', 'pending', 'alert'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setActiveFilter(f)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                          activeFilter === f 
                            ? 'bg-slate-900 text-white shadow-lg' 
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {f === 'all' ? 'Tous' : STATUS_CONFIG[f as Status].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 text-[10px] uppercase font-bold tracking-widest text-slate-400 border-b border-slate-100">
                          <th className="px-6 py-4">Fournisseur</th>
                          <th className="px-6 py-4">Produit</th>
                          <th className="px-6 py-4">Origine</th>
                          <th className="px-6 py-4">Risque Zone</th>
                          <th className="px-6 py-4">Statut</th>
                          <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSuppliers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-20 text-center text-slate-400">
                              <Info className="mx-auto mb-2 opacity-20" size={32} />
                              <div className="text-sm font-medium">Aucun fournisseur trouvé.</div>
                            </td>
                          </tr>
                        ) : (
                          filteredSuppliers.map((s) => (
                            <tr 
                              key={s.id} 
                              className="hover:bg-slate-50 transition-colors group cursor-pointer"
                              onClick={() => setSelectedSupplierId(s.id)}
                            >
                              <td className="px-6 py-4">
                                <div className="font-bold text-slate-900">{s.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-tighter">{s.ref} · {s.coop}</div>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600 font-medium">{s.product}</td>
                              <td className="px-6 py-4 text-sm text-slate-600 font-medium">{s.country}</td>
                              <td className="px-6 py-4">
                                <span className={`text-xs font-bold flex items-center gap-1.5 ${RISK_CONFIG[s.risk].color}`}>
                                  <div className={`w-1.5 h-1.5 rounded-full bg-current`} />
                                  {RISK_CONFIG[s.risk].label}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${STATUS_CONFIG[s.status].bgColor} ${STATUS_CONFIG[s.status].color}`}>
                                  {STATUS_CONFIG[s.status].label}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button className="p-2 rounded-lg border border-slate-200 text-slate-400 group-hover:border-slate-900 group-hover:text-slate-900 transition-all">
                                  <ChevronRight size={16} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {/* Side Details Panel */}
      <AnimatePresence>
        {selectedSupplier && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSupplierId(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl z-[101] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight">{selectedSupplier.name}</h2>
                  <p className="text-xs text-slate-400 mt-1 uppercase tracking-tighter">{selectedSupplier.ref} · {selectedSupplier.email}</p>
                </div>
                <button 
                  onClick={() => setSelectedSupplierId(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-10">
                {/* Guide Plan d'Action Pro */}
                <section className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#1db954] mb-4 flex items-center gap-2">
                    <CheckCircle2 size={12} /> Votre Guide Pas à Pas
                  </h4>
                  <div className="space-y-2">
                    <StepItem 
                      num="1" 
                      label="Localiser la parcelle" 
                      desc="Saisissez les coordonnées GPS envoyées par votre fournisseur dans le module ci-dessous."
                      done={!!selectedSupplier.lat}
                    />
                    <StepItem 
                      num="2" 
                      label="Lancer l'audit Satellite" 
                      desc="Cliquez sur 'Lancer l'audit' pour que notre IA vérifie l'historique de déforestation."
                      done={!!satelliteReport}
                    />
                    <StepItem 
                      num="3" 
                      label="Signer la Déclaration" 
                      desc="Une fois validé, prévisualisez et signez la déclaration légale Annex II."
                      done={selectedSupplier.status === 'ok'}
                    />
                  </div>
                </section>

                {/* Details Grid */}
                <section>
                  <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-4">Fiche Technique</label>
                  <div className="grid grid-cols-2 gap-4">
                    <DetailItem label="Coopérative" value={selectedSupplier.coop} />
                    <DetailItem label="Type d'Entité" value={selectedSupplier.type === 'cooperative' ? '🏛️ Coopérative / Groupe' : '👤 Producteur Individuel'} />
                    <DetailItem label="Produit" value={selectedSupplier.product} />
                    <DetailItem label="Code HS (EUDR)" value={selectedSupplier.hsCode || "—"} />
                    <DetailItem label="Origine" value={`${selectedSupplier.country}${selectedSupplier.region !== '—' ? ', ' + selectedSupplier.region : ''}`} />
                    <DetailItem label="Coordonnées GPS" value={selectedSupplier.lat ? `${selectedSupplier.lat}, ${selectedSupplier.lng}` : "Donnée manquante"} error={!selectedSupplier.lat} />
                    <DetailItem label="Surface" value={selectedSupplier.area || "Non renseignée"} error={!selectedSupplier.area} />
                    <DetailItem label="Certification" value={selectedSupplier.cert || "Aucune vérifiée"} error={!selectedSupplier.cert || selectedSupplier.cert === 'En cours'} />
                  </div>
                </section>

                {/* GPS Entry Section */}
                <section className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Saisie des Coordonnées GPS</label>
                    <div className="flex gap-1">
                      <div className={`w-2 h-2 rounded-full ${selectedSupplier.lat ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                        {selectedSupplier.lat ? 'Signal Reçu' : 'Signal Manquant'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Latitude</label>
                       <input 
                         value={editLat}
                         onChange={(e) => setEditLat(e.target.value)}
                         placeholder="-15.7938"
                         className="w-full p-3 rounded-lg border border-slate-200 text-sm font-bold focus:border-[#1db954] outline-none bg-white transition-all"
                       />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Longitude</label>
                       <input 
                         value={editLng}
                         onChange={(e) => setEditLng(e.target.value)}
                         placeholder="-47.8827"
                         className="w-full p-3 rounded-lg border border-slate-200 text-sm font-bold focus:border-[#1db954] outline-none bg-white transition-all"
                       />
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleSaveGPS}
                    disabled={!editLat || !editLng || (editLat === selectedSupplier.lat && editLng === selectedSupplier.lng)}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-200"
                  >
                    <Globe size={14} /> 
                    {selectedSupplier.lat ? 'Mettre à jour la parcelle' : 'Enregistrer la parcelle'}
                  </button>

                  <div className="mt-8 pt-8 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900">Module de Preuve Satellite</h4>
                      <div className="px-2 py-0.5 bg-slate-900 text-white text-[8px] font-bold rounded uppercase">Sentinel-2 Ready</div>
                    </div>

                    {!satelliteReport ? (
                      <button 
                        onClick={handleSatelliteAudit}
                        disabled={isAnalyzing || !selectedSupplier.lat}
                        className={`w-full py-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${isAnalyzing ? 'bg-slate-50 border-slate-200' : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300'}`}
                      >
                        {isAnalyzing ? (
                          <>
                            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-[10px] font-bold text-slate-500">Analyse spectrale en cours...</span>
                          </>
                        ) : (
                          <>
                            <div className="p-2 bg-emerald-500 text-white rounded-full">
                              <Globe size={18} />
                            </div>
                            <span className="text-sm font-bold text-emerald-900">Lancer l'audit automatique (2020-2026)</span>
                            <span className="text-[10px] text-emerald-600 font-medium">Vérification de non-déforestation par IA Vision</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className={`p-6 rounded-2xl border-2 ${satelliteReport.safe ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white ${satelliteReport.safe ? 'bg-emerald-500' : 'bg-red-500'}`}>
                              {satelliteReport.safe ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">{satelliteReport.safe ? 'Conformité Validée' : 'Alerte Déforestation'}</p>
                              <p className="text-[10px] text-slate-500 font-mono">Confiance: {(satelliteReport.confidence * 100).toFixed(0)}%</p>
                            </div>
                          </div>
                          <button onClick={() => setSatelliteReport(null)} className="text-[10px] font-bold text-slate-400 hover:text-slate-900 font-sans underline underline-offset-4">Relancer</button>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed italic">
                          "{satelliteReport.report}"
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {selectedSupplier.lat && (
                    <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                      <Globe size={14} className="text-emerald-500" />
                      <span className="text-[11px] font-mono text-slate-600">
                        Current: {selectedSupplier.lat}, {selectedSupplier.lng}
                      </span>
                    </div>
                  )}
                </section>

                {/* Risk Insight */}
                <section className={`p-6 rounded-2xl border ${RISK_CONFIG[selectedSupplier.risk].bgColor} ${RISK_CONFIG[selectedSupplier.risk].borderColor}`}>
                  <h4 className={`text-sm font-bold flex items-center gap-2 mb-2 ${RISK_CONFIG[selectedSupplier.risk].color}`}>
                    <Info size={16} />
                    {RISK_CONFIG[selectedSupplier.risk].title}
                  </h4>
                  <p className="text-xs leading-relaxed text-slate-700 opacity-90">
                    {RISK_CONFIG[selectedSupplier.risk].desc}
                  </p>
                </section>

                {/* Checklist */}
                <section>
                   <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-4">Points de Contrôle EUDR</label>
                   <div className="space-y-2">
                     <CheckItem label="Coordonnées géographiques de la parcelle" checked={!!selectedSupplier.lat} />
                     <CheckItem label="Date et preuve de récolte post-2020" checked={!!selectedSupplier.date} />
                     <CheckItem label="Certification environnementale reconnue" checked={!!selectedSupplier.cert && selectedSupplier.cert !== 'En cours'} />
                     <CheckItem label="Analyse satellite (absence de déforestation)" checked={selectedSupplier.status === 'ok'} />
                   </div>
                </section>

                {/* Relance Card */}
                {selectedSupplier.status !== 'ok' && (
                  <section className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900 flex items-center gap-2">
                        <Share2 size={14} className="text-blue-600" />
                        Générateur Mobile de Relance
                      </h4>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-bold rounded uppercase tracking-tighter">Canal Direct</span>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                      Partagez le lien d'accès sécurisé avec le producteur <strong className="text-slate-900">{selectedSupplier.name}</strong> pour qu'il saisisse directement ses coordonnées GPS depuis sa parcelle.
                    </p>

                    {/* Quick Link Widget */}
                    <div className="p-4 bg-white rounded-2xl border border-slate-200/60 shadow-inner flex items-center justify-between gap-3">
                      <div className="overflow-hidden">
                        <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400 block mb-0.5">Lien Unique Mobile</span>
                        <span className="text-xs font-mono font-bold text-slate-600 truncate block">
                          {window.location.origin}/?ref={selectedSupplier.ref}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const relanceUrl = `${window.location.origin}/?ref=${selectedSupplier.ref}`;
                          navigator.clipboard.writeText(relanceUrl);
                          showNotif('📋', 'Lien copié dans le presse-papiers.');
                        }}
                        className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95"
                      >
                        Copier
                      </button>
                    </div>

                    {/* Integrated WhatsApp, Email and SMS Share actions */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          const relanceUrl = `${window.location.origin}/?ref=${selectedSupplier.ref}`;
                          const rawMsg = RELANCE_TEMPLATES[selectedSupplier.lang]
                            .replace('{name}', selectedSupplier.name.split(' ')[0])
                            .replace('{ref}', selectedSupplier.ref);
                          const cleanMsg = `${rawMsg}\n\n👉 Accéder au formulaire de saisie GPS : ${relanceUrl}`;
                          const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(cleanMsg)}`;
                          window.open(whatsappUrl, '_blank');
                          showNotif('💬', 'Redirection vers WhatsApp...');
                        }}
                        className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                      >
                        <Send size={12} /> WhatsApp
                      </button>

                      <button
                        onClick={() => {
                          const relanceUrl = `${window.location.origin}/?ref=${selectedSupplier.ref}`;
                          const rawMsg = RELANCE_TEMPLATES[selectedSupplier.lang]
                            .replace('{name}', selectedSupplier.name.split(' ')[0])
                            .replace('{ref}', selectedSupplier.ref);
                          const cleanMsg = `${rawMsg}\n\nFormulaire GPS : ${relanceUrl}`;
                          const mailToUrl = `mailto:${selectedSupplier.email}?subject=Conformité EUDR - Action requise (Réf: ${selectedSupplier.ref})&body=${encodeURIComponent(cleanMsg)}`;
                          window.location.href = mailToUrl;
                          showNotif('✉️', 'Ouverture de votre messagerie...');
                        }}
                        className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                      >
                        <Mail size={12} /> Email
                      </button>
                    </div>

                    {/* QR Code and Mobile Preview Trigger Box */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowQRModal(true)}
                        className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                      >
                        <QrCode size={14} className="text-slate-500" /> Scanner QR
                      </button>

                      <button
                        type="button"
                        onClick={() => setMockMobilePreview(!mockMobilePreview)}
                        className={`p-3.5 border text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm ${mockMobilePreview ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'}`}
                      >
                        <Smartphone size={14} className={mockMobilePreview ? 'text-indigo-600 animate-bounce' : 'text-slate-500'} /> Aperçu Mobile
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActivePortalRef(selectedSupplier.ref)}
                      className="w-full mt-2 p-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <ExternalLink size={14} /> Tester le Portail en Plein Écran ⚡
                    </button>

                    {/* Simulated Mobile Mockup Pane */}
                    {mockMobilePreview && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden border border-slate-200 bg-stone-50 rounded-2xl p-4 shadow-inner mt-2 space-y-3 relative text-left"
                      >
                        <div className="absolute top-2 right-2 text-[8px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full uppercase scale-90">Mockup Live</div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">📱 Rendu Mobile du Producteur</span>
                        
                        <div className="bg-white rounded-xl p-4 border border-stone-200 space-y-3">
                          <header className="flex justify-between items-center border-b border-stone-100 pb-2">
                            <span className="text-[8px] font-bold text-emerald-800 tracking-wider">TRAVERDY compliant</span>
                            <span className="text-[8px] font-mono font-medium text-stone-400 font-bold">⚡ ID: {selectedSupplier.ref}</span>
                          </header>
                          <div className="space-y-1">
                            <h5 className="text-[10px] font-bold text-indigo-950 flex items-center gap-1">
                              📍 Portail Producteur
                            </h5>
                            <p className="text-[8px] text-stone-500 font-semibold leading-normal">
                              Bonjour {selectedSupplier.name.split(' ')[0]}, veuillez renseigner les coordonnées GPS de votre terrain.
                            </p>
                          </div>
                          
                          {/* Mini Mock Inputs */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-stone-50 p-2 rounded border border-stone-100 text-[8px] font-mono text-stone-600 font-bold text-center">Lat: _ _._ _ _ _</div>
                            <div className="bg-stone-50 p-2 rounded border border-stone-100 text-[8px] font-mono text-stone-600 font-bold text-center">Lng: _ _._ _ _ _</div>
                          </div>
                          
                          <div className="py-2 px-3 bg-emerald-600 text-white font-bold text-[8px] text-center rounded-lg shadow-sm">
                            Détection position GPS (Mobile)
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </section>
                )}

                {/* Declaration Download */}
                {selectedSupplier.status === 'ok' && (
                  <section className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
                    <h4 className="text-sm font-bold text-emerald-900 mb-2 flex items-center gap-2">
                      <ClipboardCheck size={16} />
                      Prêt pour Déclaration
                    </h4>
                    <p className="text-xs text-emerald-800/70 mb-4 leading-relaxed">
                      Ce dossier répond à 100% des exigences européennes. Vous pouvez télécharger la déclaration officielle.
                    </p>
                    <button 
                      onClick={() => setIsPreviewOpen(true)}
                      className="w-full py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                    >
                      <Download size={14} /> Prévisualiser la déclaration EUDR
                    </button>
                  </section>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 space-y-3">
                {selectedSupplier.status !== 'ok' && (
                  <button 
                    onClick={() => validateSupplier(selectedSupplier.id)}
                    className="w-full py-4 bg-[#1db954] text-white rounded-xl text-sm font-bold hover:bg-[#1db954]/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                  >
                    <CheckCircle2 size={18} /> Valider Manuellement
                  </button>
                )}

                <button 
                  onClick={() => deleteSupplier(selectedSupplier.id)}
                  className="w-full py-3 bg-white text-red-500 border border-red-100 rounded-xl text-xs font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                >
                  Supprimer ce dossier
                </button>
                <button 
                  onClick={() => setSelectedSupplierId(null)}
                  className="w-full py-4 bg-white border border-slate-200 text-slate-900 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Declaration Preview Modal */}
      <AnimatePresence>
        {isPreviewOpen && selectedSupplier && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPreviewOpen(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-4xl h-[80vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10"
            >
              <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3 font-display font-bold text-lg">
                  <FileText className="text-emerald-600" />
                  Dossier de Preuve de Diligence EUDR
                </div>
                
                {/* Tab selector for DDS and Proof Pack */}
                <div className="flex bg-slate-200/70 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('statement')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${previewTab === 'statement' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    📄 Déclaration DDS (Annex II)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('proof_pack')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${previewTab === 'proof_pack' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    🛡️ Audits & Certificat IA
                  </button>
                </div>

                <button onClick={() => setIsPreviewOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors self-end md:self-auto">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-12 bg-slate-100">
                {previewTab === 'proof_pack' ? (
                  <div className="max-w-3xl mx-auto bg-stone-900 text-stone-100 rounded-[2.5rem] p-10 md:p-14 shadow-2xl space-y-8 font-sans border border-stone-800 text-left">
                    <div className="flex justify-between items-start border-b border-stone-800 pb-6">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-900/60">
                          TRAVERDY SATELLITE SECURE
                        </span>
                        <h2 className="text-xl font-bold tracking-tight text-white pt-2">AI Proof Packet & Certificate</h2>
                        <p className="text-xs text-stone-400">Réf. Audit Blockchain: <span className="font-mono text-emerald-400">tx-eudr-{selectedSupplier.ref.toLowerCase()}</span></p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl">🛡️</div>
                        <p className="text-[9px] text-stone-500 uppercase tracking-widest font-mono font-bold mt-1">Status: OK</p>
                      </div>
                    </div>

                    {/* Details grid layout inside black UI card */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      <div className="bg-stone-950/60 p-5 rounded-2xl border border-stone-800/80 space-y-3">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">🛰️ Vérification Satellite AI</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-stone-500">Imagerie Radar:</span>
                            <span className="font-semibold text-stone-300">Sentinelle-2 RGB/NDVI</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-stone-500">Dernier passage:</span>
                            <span className="font-semibold text-stone-300">{selectedSupplier.date}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-stone-500">Diagnostic forêt:</span>
                            <span className="font-semibold text-emerald-400">Aucun signal de coupe rasée</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-stone-500">Surface analysée:</span>
                            <span className="font-semibold text-stone-300">{selectedSupplier.area || "45 hectares"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-stone-950/60 p-5 rounded-2xl border border-stone-800/80 space-y-3">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">⚖️ Conformité Légale (EU 2023/1115)</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-stone-500">Article 3 (Déforestation):</span>
                            <span className="font-semibold text-emerald-400">Conforme (Post-2020)</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-stone-500">Droits locaux & Travail:</span>
                            <span className="font-semibold text-emerald-400">Conforme (Vérifié)</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-stone-500">Niveau de Risque Pays:</span>
                            <span className="font-semibold text-emerald-400 uppercase">{selectedSupplier.risk}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-stone-500">Certificat tiers:</span>
                            <span className="font-semibold text-[#1db954]">{selectedSupplier.cert || "Rainforest Alliance"}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Graphic Interactive Radar representation */}
                    <div className="bg-stone-950 border border-stone-800 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 justify-between">
                      <div className="space-y-2 max-w-sm">
                        <h5 className="font-bold text-sm text-stone-200">Empreinte Cartographique & Polygone</h5>
                        <p className="text-xs text-stone-500 leading-relaxed">
                          Le polygone tracé délimite précisément la parcelle de récolte à <span className="font-mono text-stone-300 font-bold">{selectedSupplier.lat}, {selectedSupplier.lng}</span>. Il prouve l'absence d'empiétement sur les massifs forestiers classés.
                        </p>
                      </div>

                      <div className="w-32 h-32 bg-stone-900 border-2 border-dashed border-emerald-950 rounded-full shrink-0 relative overflow-hidden flex items-center justify-center">
                        <div className="absolute inset-0 bg-emerald-500/5 rounded-full" />
                        <div className="absolute w-24 h-24 border border-emerald-900/40 rounded-full flex items-center justify-center">
                          <div className="absolute w-16 h-16 border border-emerald-800/20 rounded-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                          </div>
                        </div>
                        <div className="absolute w-[1px] h-[64px] bg-gradient-to-t from-emerald-400 to-transparent top-0 left-16 origin-bottom animate-spin" style={{ animationDuration: '4s' }} />
                        <span className="text-[9px] font-mono text-stone-600 absolute bottom-2">RANGE: 15km</span>
                      </div>
                    </div>

                    {/* Direct Proof Pack File Downloader Box */}
                    <div className="p-5 bg-gradient-to-r from-emerald-950/40 to-cyan-950/30 rounded-2xl border border-emerald-900/40 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="space-y-1 text-left">
                        <h5 className="font-bold text-xs text-stone-200 uppercase tracking-tight">Compilation Preuve Pratique (ZIP)</h5>
                        <p className="text-[10px] text-stone-400">Contient: Images Satellite Haute Résolution, Tracé de Polygone GeoJSON, Certificat de Signature.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          showNotif('📥', "Préparation du dossier compressé (.zip) avec toutes les pièces justificatives...");
                          setTimeout(() => {
                            showNotif('🛡️', "Téléchargement démarré : Traverdy_EUDR_ProofPack_" + selectedSupplier.ref + ".zip");
                          }, 1500);
                        }}
                        className="px-6 py-3 bg-[#1db954] hover:bg-[#1db954]/95 text-stone-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/40 active:scale-95 transition-all shrink-0"
                      >
                        <Download size={14} /> Télécharger le Pack
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto bg-white shadow-lg p-16 font-serif text-[#1a1a1a] min-h-full">
                    <div className="border-b-2 border-slate-900 pb-8 mb-8 flex justify-between items-start">
                      <div>
                        <h1 className="text-2xl font-bold uppercase tracking-tight font-sans">European Union Deforestation Regulation</h1>
                        <p className="text-xs font-sans text-slate-500 mt-1">Due Diligence Statement Template (Standardized)</p>
                      </div>
                      <div className="text-right">
                        <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full font-sans uppercase">Authentifié Blockchain</div>
                        <p className="text-[10px] font-sans mt-2">REF: {selectedSupplier.ref}</p>
                      </div>
                    </div>

                    <div className="space-y-8 text-sm leading-relaxed text-left">
                      <section>
                        <h4 className="font-sans font-bold uppercase text-[10px] text-slate-400 mb-2">1. Operator Information</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="font-bold">Name & Address:</p>
                            <p className="text-slate-600">Traverdy Demo Account<br />24 Rue de la Paix, 75002 Paris, France</p>
                          </div>
                          <div>
                            <p className="font-bold">EORI Number:</p>
                            <p className="text-slate-600">FR12345678901234</p>
                          </div>
                        </div>
                      </section>

                      <section>
                        <h4 className="font-sans font-bold uppercase text-[10px] text-slate-400 mb-2">2. Relevant Commodity & Products</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-3 bg-slate-50 rounded">
                            <p className="text-[10px] text-slate-400">HS CODE</p>
                            <p className="font-bold">{selectedSupplier.hsCode}</p>
                          </div>
                          <div className="p-3 bg-slate-50 rounded">
                            <p className="text-[10px] text-slate-400">PRODUCT</p>
                            <p className="font-bold uppercase">{selectedSupplier.product}</p>
                          </div>
                          <div className="p-3 bg-slate-50 rounded">
                            <p className="text-[10px] text-slate-400">COUNTRY OF ORIGIN</p>
                            <p className="font-bold">{selectedSupplier.country}</p>
                          </div>
                        </div>
                      </section>

                      <section>
                        <h4 className="font-sans font-bold uppercase text-[10px] text-slate-400 mb-2">3. Geolocation Data (GPS Coordinates)</h4>
                        <div className="p-4 border border-slate-200 rounded-lg">
                          <p className="mb-2 italic">Geolocation of all plots of land where the relevant commodity was produced:</p>
                          <div className="font-mono text-xs bg-slate-900 text-emerald-400 p-3 rounded">
                            {selectedSupplier.lat}, {selectedSupplier.lng} (Polygon Verified via Satellite)
                          </div>
                        </div>
                      </section>

                      <section>
                        <h4 className="font-sans font-bold uppercase text-[10px] text-slate-400 mb-2">4. Conclusion of the Due Diligence</h4>
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-900">
                          The operator concludes that there is **null or only a negligible risk** that the relevant products are non-compliant with Article 3 of Regulation (EU) 2023/1115.
                        </div>
                      </section>

                      <div className="pt-12 flex justify-between items-end italic opacity-50">
                        <div>
                          <p>Date: {new Date().toLocaleDateString()}</p>
                          <p className="mt-4 border-t border-slate-300 pt-2">Authorized Signature</p>
                        </div>
                        <div className="text-[10px] font-sans">Page 1 of 1</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 flex gap-4 bg-white">
                <button 
                  onClick={() => setIsPreviewOpen(false)}
                  className="flex-1 py-4 text-slate-500 font-bold text-sm hover:text-slate-900"
                >
                  Fermer l'aperçu
                </button>
                <button 
                  onClick={handleSign}
                  disabled={isSigning}
                  className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50"
                >
                  {isSigning ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download size={20} />
                  )}
                  Signer avec DocuSign & Envoyer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Billing & Subscription Modal */}
      <AnimatePresence>
        {isBillingOpen && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBillingOpen(false)}
              className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">Plans & Facturation</h3>
                  <p className="text-sm text-slate-500 mt-1">Choisissez le forfait adapté à votre volume d'importation.</p>
                </div>
                <button onClick={() => setIsBillingOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-12 bg-slate-50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Plan Starter */}
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 flex flex-col shadow-sm">
                    <div className="mb-8">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full uppercase tracking-widest">Starter</span>
                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-4xl font-black">0€</span>
                        <span className="text-slate-400 text-sm">/mois</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Pour tester la plateforme.</p>
                    </div>
                    <div className="space-y-4 flex-1">
                      <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
                        <Check size={14} className="text-emerald-500" /> Jusqu'à 3 fournisseurs
                      </div>
                      <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
                        <Check size={14} className="text-emerald-500" /> Relances manuelles
                      </div>
                      <div className="flex items-center gap-3 text-xs font-medium text-slate-300">
                        <X size={14} /> Audit Satellite IA
                      </div>
                      <div className="flex items-center gap-3 text-xs font-medium text-slate-300">
                        <X size={14} /> Signature DocuSign
                      </div>
                    </div>
                    <button className="w-full mt-8 py-4 bg-slate-100 text-slate-400 rounded-2xl text-sm font-bold cursor-not-allowed">
                      Plan actuel
                    </button>
                  </div>

                  {/* Plan Pro */}
                  <div className="bg-white p-8 rounded-[2rem] border-2 border-[#1db954] flex flex-col shadow-xl relative scale-105 z-10">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 bg-[#1db954] text-white text-[10px] font-bold rounded-full uppercase tracking-widest shadow-lg">14 jours offerts</div>
                    <div className="mb-8">
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-600 text-[10px] font-bold rounded-full uppercase tracking-widest">Business Pro</span>
                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-4xl font-black">99€</span>
                        <span className="text-slate-400 text-sm">/mois</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2 font-medium">Essai gratuit de 14 jours, puis facturation mensuelle.</p>
                    </div>
                    <div className="space-y-4 flex-1">
                      <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
                        <Check size={14} className="text-emerald-500" /> Fournisseurs illimités
                      </div>
                      <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
                        <Check size={14} className="text-emerald-500" /> Audit Satellite illimité
                      </div>
                      <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
                        <Check size={14} className="text-emerald-500" /> Signature DocuSign certifiée
                      </div>
                      <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
                        <Check size={14} className="text-emerald-500" /> Support expert 24/7
                      </div>
                    </div>
                    <button 
                      onClick={() => showNotif('💳', "Activation de l'essai gratuit via Stripe sécurisé...")}
                      className="w-full mt-8 py-4 bg-[#1db954] text-white rounded-2xl text-sm font-bold hover:bg-[#1db954]/90 transition-all shadow-lg shadow-emerald-100"
                    >
                      Commencer l'essai gratuit
                    </button>
                    <p className="text-[9px] text-center text-slate-400 mt-4">Aucun prélèvement avant 14 jours. Annulable en 1 clic.</p>
                  </div>

                  {/* Plan Enterprise */}
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 flex flex-col shadow-sm">
                    <div className="mb-8">
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase tracking-widest">Enterprise</span>
                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-4xl font-black">Sur Devis</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Pour les grands groupes.</p>
                    </div>
                    <div className="space-y-4 flex-1">
                      <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
                        <Check size={14} className="text-emerald-500" /> Intégration API & ERP
                      </div>
                      <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
                        <Check size={14} className="text-emerald-500" /> Tableau de bord Multi-entités
                      </div>
                      <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
                        <Check size={14} className="text-emerald-500" /> Garantie légale étendue
                      </div>
                    </div>
                    <button className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all">
                      Contacter l'équipe
                    </button>
                  </div>
                </div>

                <div className="mt-12 text-center text-[10px] text-slate-400 max-w-2xl mx-auto leading-relaxed">
                  Paiements sécurisés par Stripe. Archivage légal conforme aux normes EUDR et GDPR.
                  En vous abonnant, vous financez également des projets de reforestation via nos partenaires.
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-10 border-b border-slate-100 flex justify-between items-end">
                <div>
                  <h3 className="text-2xl font-bold font-display tracking-tight text-slate-900">Ajouter un Import</h3>
                  <p className="text-sm text-slate-400 mt-1">Conformité gérée via le registre EUDR.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setModalTab('manual')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${modalTab === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    Manuel
                  </button>
                  <button 
                    onClick={() => setModalTab('registry')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${modalTab === 'registry' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    Registre
                  </button>
                </div>
              </div>

              {modalTab === 'manual' ? (
                <>
                  <div className="p-10 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nom / Coopérative</label>
                        <input 
                          value={newSupplier.name}
                          onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                          className="w-full p-4 rounded-xl border border-slate-200 focus:border-[#1db954] focus:ring-1 focus:ring-[#1db954] outline-none transition-all text-sm font-bold" 
                          placeholder="Ex: João Silva" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Type d'entité</label>
                        <select 
                          value={newSupplier.type}
                          onChange={(e) => setNewSupplier({...newSupplier, type: e.target.value as any})}
                          className="w-full p-4 rounded-xl border border-slate-200 outline-none text-sm font-bold appearance-none bg-white font-sans"
                        >
                          <option value="individual">👤 Producteur Individuel</option>
                          <option value="cooperative">🏛️ Coopérative / Groupe</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Origine</label>
                        <select 
                          value={newSupplier.country}
                          onChange={(e) => setNewSupplier({...newSupplier, country: e.target.value})}
                          className="w-full p-4 rounded-xl border border-slate-200 outline-none text-sm font-bold appearance-none bg-white font-sans"
                        >
                          <option>Brésil</option>
                          <option>Indonésie</option>
                          <option>Côte d'Ivoire</option>
                          <option>Ghana</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email Producteur</label>
                        <input 
                          value={newSupplier.email}
                          onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})}
                          className="w-full p-4 rounded-xl border border-slate-200 outline-none text-sm font-bold" 
                          type="email" 
                          placeholder="contact@farm.co" 
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Matière Première</label>
                      <select 
                        value={newSupplier.product}
                        onChange={(e) => setNewSupplier({...newSupplier, product: e.target.value})}
                        className="w-full p-4 rounded-xl border border-slate-200 outline-none text-sm font-bold appearance-none bg-white font-sans"
                      >
                        <option>Café</option>
                        <option>Cacao</option>
                        <option>Huile de Palme</option>
                        <option>Bois</option>
                      </select>
                    </div>
                    <div className="p-6 bg-emerald-50 rounded-2xl flex gap-5 items-start border border-emerald-100">
                      <div className="p-2 bg-white text-emerald-600 rounded-xl shadow-sm">
                        <Globe size={20} />
                      </div>
                      <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                        En cliquant sur inviter, un email contenant un lien de géo-référencement sécurisé sera envoyé. Le producteur pourra saisir ses parcelles sur une carte interactive.
                      </p>
                    </div>
                  </div>
                  <div className="p-10 bg-slate-50 flex gap-4">
                    <button 
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-4 text-slate-500 font-bold text-sm hover:text-slate-900 transition-all"
                    >
                      Annuler
                    </button>
                    <button 
                      onClick={handleAddSupplier}
                      disabled={!newSupplier.name || !newSupplier.email}
                      className="flex-[2] py-4 bg-[#1db954] text-white rounded-2xl font-bold text-sm shadow-xl shadow-emerald-200 hover:bg-[#1db954]/90 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                      Ajouter et Inviter
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-10 space-y-4 max-h-[500px] overflow-y-auto">
                    <p className="text-xs text-slate-500 mb-4">Sélectionnez un fournisseur identifié dans les registres officiels pour pré-remplir les données de risque.</p>
                    {SAMPLE_REAL_EXPORTERS.map((exporter) => (
                      <div 
                        key={exporter.name} 
                        className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-[#1db954] hover:bg-emerald-50 transition-all group cursor-pointer"
                        onClick={() => handleAddFromExporter(exporter)}
                      >
                        <div>
                          <div className="font-bold text-slate-900">{exporter.name}</div>
                          <div className="flex gap-2 mt-1">
                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-tight">
                              <Globe size={10} /> {exporter.country}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 rounded-full uppercase tracking-tight">
                              {exporter.product}
                            </span>
                          </div>
                        </div>
                        <button className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 group-hover:bg-[#1db954] group-hover:text-white group-hover:border-[#1db954] transition-all">
                          <Plus size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="p-10 bg-slate-50">
                    <button 
                      onClick={() => setIsModalOpen(false)}
                      className="w-full py-4 text-slate-500 font-bold text-sm hover:text-slate-900 transition-all"
                    >
                      Fermer
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Code Magnified Modal */}
      <AnimatePresence>
        {showQRModal && selectedSupplier && (
          <div className="fixed inset-0 z-[450] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQRModal(false)}
              className="absolute inset-0 bg-slate-900/85 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl text-center space-y-6"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-sm font-bold tracking-tight text-slate-950 font-sans">QR Code Unique Producteur</span>
                <button onClick={() => setShowQRModal(false)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-500 font-medium">
                  Faites scanner ce QR Code par <strong className="text-slate-900">{selectedSupplier.name}</strong> avec son smartphone pour ouvrir son formulaire de conformité en direct.
                </p>

                {/* Aesthetic Visual QR Code SVG Mockup */}
                <div className="w-52 h-52 bg-white border border-slate-200 rounded-2xl p-4 mx-auto flex flex-col items-center justify-center relative shadow-inner">
                  <svg viewBox="0 0 100 100" className="w-40 h-40 text-slate-900">
                    {/* Corners */}
                    <rect x="0" y="0" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="6" />
                    <rect x="5" y="5" width="15" height="15" fill="currentColor" />
                    <rect x="75" y="0" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="6" />
                    <rect x="80" y="5" width="15" height="15" fill="currentColor" />
                    <rect x="0" y="75" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="6" />
                    <rect x="5" y="80" width="15" height="15" fill="currentColor" />
                    {/* Inner dots */}
                    <rect x="35" y="10" width="8" height="8" fill="currentColor" />
                    <rect x="50" y="5" width="12" height="6" fill="currentColor" />
                    <rect x="10" y="35" width="10" height="10" fill="currentColor" />
                    <rect x="35" y="35" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="6" />
                    <circle cx="50" cy="50" r="5" fill="currentColor" />
                    <rect x="75" y="35" width="12" height="12" fill="currentColor" />
                    <rect x="35" y="75" width="20" height="15" fill="currentColor" />
                    <rect x="75" y="75" width="15" height="15" fill="currentColor" />
                    {/* Tiny details */}
                    <rect x="60" y="15" width="6" height="6" fill="currentColor" />
                    <rect x="15" y="60" width="6" height="6" fill="currentColor" />
                  </svg>
                  <div className="absolute bg-[#1db954] text-white px-2 py-0.5 rounded-full text-[8px] font-bold uppercase border-2 border-white scale-110">
                    TRAVERDY
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-center">
                  <span className="text-[10px] font-mono font-bold text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap max-w-[280px]">
                    {window.location.origin}/?ref={selectedSupplier.ref}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/?ref=${selectedSupplier.ref}`);
                  showNotif('📋', 'Lien copié !');
                  setShowQRModal(false);
                }}
                className="w-full py-3 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                Copier le lien direct
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-8 py-5 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[360px]"
          >
            <span className="text-2xl">{notification.icon}</span>
            <span className="text-sm font-bold tracking-tight">{notification.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GDPR Consent & Privacy */}
      <AnimatePresence>
        {!gdprConsent && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:max-w-md bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 shadow-2xl z-[400] flex flex-col space-y-4 font-sans text-left"
          >
            <div className="flex justify-between items-start gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl shrink-0">
                  <Shield size={20} />
                </div>
                <h4 className="text-sm font-black tracking-tight self-center">{d.gdprBannerTitle}</h4>
              </div>
              <button
                type="button"
                onClick={() => saveGdprChoice('only_essential')}
                className="text-[11px] text-slate-400 hover:text-emerald-400 underline font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 bg-transparent border-none mt-1"
              >
                {d.gdprBtnRefuse} ✕
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {d.gdprBannerText}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => saveGdprChoice('accepted')}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition-all cursor-pointer text-center"
              >
                {d.gdprBtnAccept}
              </button>
              <button
                type="button"
                onClick={() => saveGdprChoice('only_essential')}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
              >
                {d.gdprBtnEssential}
              </button>
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowGdprDetailModal(true)}
                className="text-[11px] text-slate-400 hover:text-slate-300 underline font-semibold cursor-pointer transition-colors"
              >
                {d.gdprBtnLearnMore} (RGPD / GDPR)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGdprDetailModal && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGdprDetailModal(false)}
              className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative z-10 w-full max-w-2xl bg-white rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] text-slate-800 font-sans text-left"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Shield size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 leading-tight">{d.gdprModalTitle}</h3>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest block w-fit mt-1">Sovereign Compliance</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGdprDetailModal(false)}
                  className="p-1 px-2.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 font-black text-xs cursor-pointer transition-all"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-6">
                <p className="text-xs text-slate-500 leading-relaxed">
                  {d.gdprModalIntro}
                </p>

                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <Lock size={12} className="text-emerald-500" />
                    {appLang === 'FR' ? "Détail de notre utilisation" : "Operational Storage Details"}
                  </h4>

                  <div className="border border-slate-150 rounded-2xl overflow-hidden text-[11px]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-150">
                          <th className="p-3 font-semibold">{d.gdprTableColCookie}</th>
                          <th className="p-3 font-semibold">{d.gdprTableColType}</th>
                          <th className="p-3 font-semibold">{d.gdprTableColPurpose}</th>
                          <th className="p-3 font-semibold">{d.gdprTableColDuration}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        <tr className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-[#1db954]">{d.gdprRow1Name}</td>
                          <td className="p-3 font-medium text-slate-500">{d.gdprRow1Type}</td>
                          <td className="p-3 leading-relaxed text-slate-500 text-left">{d.gdprRow1Purpose}</td>
                          <td className="p-3 font-medium text-slate-500">{d.gdprRow1Duration}</td>
                        </tr>
                        <tr className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-[#1db954]">{d.gdprRow2Name}</td>
                          <td className="p-3 font-medium text-slate-500">{d.gdprRow2Type}</td>
                          <td className="p-3 leading-relaxed text-slate-500 text-left">{d.gdprRow2Purpose}</td>
                          <td className="p-3 font-medium text-slate-500">{d.gdprRow2Duration}</td>
                        </tr>
                        <tr className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-[#1db954]">{d.gdprRow3Name}</td>
                          <td className="p-3 font-medium text-slate-500">{d.gdprRow3Type}</td>
                          <td className="p-3 leading-relaxed text-slate-500 text-left">{d.gdprRow3Purpose}</td>
                          <td className="p-3 text-slate-500 font-medium">{d.gdprRow3Duration}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Shield size={12} className="text-emerald-500" />
                    {d.gdprModalSec2Title}
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed text-left">
                    {d.gdprModalSec2Text}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!gdprConsent) {
                      saveGdprChoice('accepted');
                    }
                    setShowGdprDetailModal(false);
                  }}
                  className="px-6 py-2.5 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-slate-300 transition-all cursor-pointer"
                >
                  {d.gdprModalClose}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Risk Analysis and Compliance ROI Simulator Component ---

const RiskRoiCalculator = ({
  suppliers,
  setSuppliers,
  setCurrentView,
  setActivePortalRef,
  showNotif
}: {
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  setCurrentView: (v: 'dashboard' | 'suppliers' | 'declarations' | 'pitch') => void;
  setActivePortalRef: (ref: string | null) => void;
  showNotif: (icon: string, msg: string) => void;
}) => {
  const [numSuppliers, setNumSuppliers] = useState(24);
  const [annualTons, setAnnualTons] = useState(180);
  const [commodity, setCommodity] = useState<'coffee' | 'cocoa' | 'soy' | 'timber'>('coffee');

  const estimatedSaaSPrice = useMemo(() => {
    // Base 99 EUR + $5 per supplier + $0.7 per ton. Highly logical pricing.
    const base = 99;
    const itemFactor = numSuppliers * 5;
    const tonFactor = annualTons * 0.7;
    const commodityMultiplier = commodity === 'timber' ? 1.4 : commodity === 'soy' ? 1.2 : 1.0;
    return Math.round((base + itemFactor + tonFactor) * commodityMultiplier);
  }, [numSuppliers, annualTons, commodity]);

  const hoursSaved = useMemo(() => {
    // Saves roughly 2.2 hours of tedious manual paperwork per supplier
    return Math.round(15 + numSuppliers * 2.2);
  }, [numSuppliers]);

  const legalRiskValue = useMemo(() => {
    // EUDR penalties are 4% of customer global annual revenue of target goods. 
    // Cocoa/coffee pricing average is about 5000 EUR per ton.
    const productPricePerTon = commodity === 'timber' ? 6200 : commodity === 'cocoa' ? 5800 : commodity === 'coffee' ? 4500 : 3200;
    const valueOfGoods = annualTons * productPricePerTon;
    return Math.round(valueOfGoods * 0.04);
  }, [annualTons, commodity]);

  const handleScenarioClean = () => {
    const fresh = INITIAL_DEMO_SUPPLIERS.map(item => ({
      ...item,
      status: (item.ref === '1201-ID-2026-112') ? 'alert' as const : 'ok' as const,
      cert: item.ref === '0901-BR-2026-455' ? 'Rainforest Alliance' : item.cert
    }));
    setSuppliers(fresh);
    localStorage.setItem('demo_suppliers', JSON.stringify(fresh));
    showNotif('🟢', 'Exercice clos. Base de test rétablie en état conforme.');
  };

  const handleScenarioDeforestation = () => {
    const alerted = suppliers.map(item => {
      if (item.ref === '0901-BR-2026-455') {
        return {
          ...item,
          status: 'alert' as const,
          cert: 'ALERTE SATELLITE DIRECTE : Déforestation détectée par Copernicus radar'
        };
      }
      return item;
    });
    setSuppliers(alerted);
    localStorage.setItem('demo_suppliers', JSON.stringify(alerted));
    showNotif('🚨', 'Alerte Copernicus déclenchée sur Cooperativa Café Brasil (Simulation de crise)');
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* SaaS Elevator Pitch Top Banner */}
      <div className="bg-gradient-to-br from-slate-900 to-emerald-950 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden border border-emerald-500/15">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl -z-0" />
        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-full uppercase tracking-widest border border-emerald-500/20">MODULE D'AVANT-PROJET & RISQUES</span>
              <span className="text-xs text-emerald-400 font-medium">✦ Évaluation légale des flux d'importations régulés (EUDR)</span>
            </div>
            <h2 className="text-3xl font-black font-display tracking-tight">Estimez votre conformité légale & ROI</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Ce module d'audit financier et règlementaire vous permet de simuler la structure de votre chaîne logistique pour en déduire les <strong>expositions financières d'amendes douanières</strong> et évaluer le <strong>retour sur investissement opérationnel</strong> de la dématérialisation sur Traverdy.
            </p>
          </div>
          <button 
            onClick={() => setCurrentView('dashboard')}
            className="px-6 py-4 bg-[#1db954] text-white hover:bg-[#1db954]/90 rounded-2xl font-bold text-sm shadow-xl active:scale-95 transition-all flex items-center gap-2 shrink-0"
          >
            <span>Retourner au Tableau de Bord</span> <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Scénario trigger card panel */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Action Trigger Box */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200/85 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-950 font-display flex items-center gap-2">
                <Sparkles size={18} className="text-emerald-500 animate-pulse" />
                Simulations de Crise & Exercices Pratiques
              </h3>
              <p className="text-xs text-slate-500 mt-1">Conformément aux directives de diligence raisonnée, effectuez des simulations à blanc pour tester vos processus internes d'urgence.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Reset Regular */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Exercice 1</span>
                  <h4 className="font-bold text-xs text-slate-950">Clôturer les simulations</h4>
                  <p className="text-[10px] text-slate-400">Rétablit l'ensemble de la base de données de test à un état entièrement conforme.</p>
                </div>
                <button 
                  onClick={handleScenarioClean}
                  className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-800 font-bold text-[11px] rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 size={12} className="text-emerald-500" /> Clôturer l'exercice 🟢
                </button>
              </div>

              {/* Deforestation Alert trigger */}
              <div className="p-5 rounded-2xl bg-red-50/50 border border-red-100 flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-red-600 block">Exercice 2</span>
                  <h4 className="font-bold text-xs text-slate-950 font-sans">Simuler une Alerte Satellite</h4>
                  <p className="text-[10px] text-slate-400">Déclenche un signal d'urgence de déforestation satellite Copernicus sur un fournisseur.</p>
                </div>
                <button 
                  onClick={handleScenarioDeforestation}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] rounded-xl transition-all shadow-md shadow-red-100 flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle size={12} /> Lancer l'alerte Copernicus 🚨
                </button>
              </div>

              {/* Farmer quick access trigger */}
              <div className="p-5 rounded-2xl bg-[#f0f9ff] border border-blue-100 flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-blue-600 block">Exercice 3</span>
                  <h4 className="font-bold text-xs text-slate-950">Vérifier Portail Mobilisés</h4>
                  <p className="text-[10px] text-slate-400">Ouvre la fiche et le parcours web réactif optimisé pour les producteurs en zone rurale.</p>
                </div>
                <button 
                  onClick={() => {
                    setActivePortalRef('0901-BR-2026-455');
                    showNotif('☕', 'Chargement du Portail Mobile de Cafe Brasil...');
                  }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-xl transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-1.5"
                >
                  <ExternalLink size={12} /> Tester Fiche Producteur ☕
                </button>
              </div>

            </div>
          </div>

          {/* SaaS Core arguments / Sell Sheets */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200/85 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-950 font-display flex items-center gap-2">
                <Award size={18} className="text-[#1db954]" />
                Piliers de Résilience Réduisant le Risque Opérationnel
              </h3>
              <p className="text-xs text-slate-500 mt-1">Comment l'infrastructure technique Traverdy neutralise les risques légaux de la chaîne d'importation.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs shadow-inner">1</div>
                <h4 className="text-xs font-bold text-slate-950">Zéro téléchargement requis</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Zéro friction pour les producteurs locaux : un simple lien léger accessible par SMS ou messagerie instantanée permet de recueillir les coordonnées GPS de la parcelle, même en zone à faible connectivité.
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shadow-inner">2</div>
                <h4 className="text-xs font-bold text-slate-950">Alerte Précoce Constatée</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Notre moteur croise de manière automatique l'historique géospatial Copernicus Sentinel-1 et Sentinel-2 avec les livraisons déclarées pour prévenir tout import issu de parcelles déboisées.
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shadow-inner">3</div>
                <h4 className="text-xs font-bold text-slate-950">Diligence Complète TRACES</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Génération instantanée et standardisée au schéma douanier européen TRACES NT du dossier de Diligence Raisonnée complet (Données foncières, attestations d'exemption, géolocalisation).
                </p>
              </div>

            </div>
          </div>

        </div>

        {/* Pricing Estimator column */}
        <div className="space-y-8">
          
          {/* Interactive Pricing Widget */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200/85 shadow-md space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Evaluation Risques vs. Coûts</span>
              <h3 className="text-lg font-bold text-slate-950 mt-1 font-display flex items-center gap-2">
                <Coins size={18} className="text-emerald-500" /> Tarificateur d'Abonnement & ROI
              </h3>
            </div>

            {/* Commodity Selector Buttons */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Matière Première Importée</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'coffee', label: '☕ Café' },
                  { key: 'cocoa', label: '🍫 Cacao' },
                  { key: 'soy', label: '🌱 Soja' },
                  { key: 'timber', label: '🪵 Bois' }
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setCommodity(item.key as any)}
                    className={cn(
                      "py-2 text-[10px] font-bold rounded-xl border transition-all text-center",
                      commodity === item.key 
                        ? "bg-slate-900 border-slate-900 text-white" 
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Range Slider 1: Number of Suppliers */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                <span>Producteurs / Fournisseurs :</span>
                <span className="font-mono text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg text-xs">{numSuppliers} producteurs</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="300" 
                value={numSuppliers}
                onChange={(e) => setNumSuppliers(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Range Slider 2: Annual Volume */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                <span>Volume Annuel Importé :</span>
                <span className="font-mono text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg text-xs">{annualTons} tonnes</span>
              </div>
              <input 
                type="range" 
                min="10" 
                max="1000" 
                value={annualTons}
                onChange={(e) => setAnnualTons(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Price Result Output */}
            <div className="p-6 rounded-2xl bg-[#0a0f0d] text-white space-y-4">
              <div>
                <span className="text-[10px] uppercase tracking-normal text-slate-500 block">Frais de Plateforme Estimés :</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl font-black text-white">{estimatedSaaSPrice}€</span>
                  <span className="text-slate-500 text-xs">/ mois</span>
                </div>
              </div>

              {/* Business Indicators */}
              <div className="border-t border-white/10 pt-4 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">✔</span>
                  <p className="text-[11px] text-slate-300 leading-tight">
                    Productivités : <strong>~{hoursSaved} heures administratives/mois</strong> épargnées en formalités d'audits manuelles.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-rose-400 mt-0.5">✔</span>
                  <p className="text-[11px] text-slate-300 leading-tight">
                    Amende Douanière Maximum Évitée : <strong>{legalRiskValue.toLocaleString()}€</strong> (calculée sur les 4% minimum du chiffre d'affaires des volumes régulés).
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  showNotif('📋', 'Rapport de simulation d\'impact copié !');
                  navigator.clipboard.writeText(`TRAVERDY EUDR - RAPPORT D'ANALYSE D'IMPACT ET CALCUL DE ROI\n\nProduit principal : ${commodity.toUpperCase()}\nVolume annuel estimé : ${annualTons} tonnes / an\nNombre de producteurs géo-localisés : ${numSuppliers}\n\nFrais de Plateforme Traverdy Pro : ${estimatedSaaSPrice} EUR / mois\nTemps administratif mensuel libéré : ~${hoursSaved} heures / mois\nExposition aux risques de pénalités douanières européennes évitée : ${legalRiskValue.toLocaleString()} EUR`);
                }}
                className="w-full py-3 bg-[#1db954] hover:bg-[#1db954]/90 text-white font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <ClipboardCheck size={14} /> Exporter le Rapport d'Impact ⚡
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

// --- Helper Components ---

const DetailItem = ({ label, value, error = false }: { label: string, value: string, error?: boolean }) => (
  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-center">
    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</div>
    <div className={`text-sm font-bold truncate ${error ? 'text-red-500 italic' : 'text-slate-900'}`}>{value}</div>
  </div>
);

const CheckItem = ({ label, checked }: { label: string, checked: boolean }) => (
  <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${checked ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-300'}`}>
      <CheckCircle2 size={16} />
    </div>
    <span className={`text-xs font-bold ${checked ? 'text-slate-900' : 'text-slate-400 italic'}`}>{label}</span>
  </div>
);
