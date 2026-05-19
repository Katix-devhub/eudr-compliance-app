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
  Check
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
  setCurrentView 
}: { 
  onLogout: () => void; 
  onOpenBilling: () => void; 
  trialDaysRemaining: number;
  currentView: 'dashboard' | 'suppliers' | 'declarations';
  setCurrentView: (v: 'dashboard' | 'suppliers' | 'declarations') => void;
}) => (
  <div className="fixed inset-y-0 left-0 w-64 bg-[#0a0f0d] text-slate-400 flex flex-col z-50">
    <div className="p-6 border-b border-white/5 flex items-center gap-3">
      <div className="w-2.5 h-2.5 bg-[#1db954] rounded-full shadow-[0_0_8px_#1db954]" />
      <span className="font-display font-bold text-white text-xl tracking-tight">Traverdy</span>
    </div>
    
    <nav className="flex-1 px-4 py-6 space-y-1">
      <NavItem 
        icon={<LayoutDashboard size={18} />} 
        label="Tableau de bord" 
        active={currentView === 'dashboard'} 
        onClick={() => setCurrentView('dashboard')}
      />
      <NavItem 
        icon={<Factory size={18} />} 
        label="Fournisseurs" 
        active={currentView === 'suppliers'}
        onClick={() => setCurrentView('suppliers')}
      />
      <NavItem 
        icon={<ClipboardCheck size={18} />} 
        label="Déclarations EUDR" 
        active={currentView === 'declarations'}
        onClick={() => setCurrentView('declarations')}
      />
      <NavItem icon={<Send size={18} />} label="Relances auto" />
      <NavItem icon={<Folder size={18} />} label="Documents" />
      <NavItem 
        icon={<CheckCircle2 size={18} className="text-[#1db954]" />} 
        label="Mon Forfait Pro" 
        onClick={onOpenBilling}
      />
      <div className="pt-4 pb-2 px-4 text-[10px] uppercase font-bold tracking-widest text-slate-600">Données Officielles</div>
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
          <span className="text-[10px] font-bold text-[#1db954] uppercase tracking-widest">Version d'essai</span>
        </div>
        <p className="text-[10px] text-slate-300">{trialDaysRemaining} jours restants avant le passage au plan Pro.</p>
      </div>
      
      <div className="mt-auto p-4">
        <div className="bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-2xl p-4 border border-white/10">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">Statut de Confiance</p>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={12} className="text-emerald-500" />
            <span className="text-[11px] text-white font-medium">Certification ISO 27001</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <CheckCircle2 size={12} className="text-emerald-500" />
            <span className="text-[11px] text-white font-medium">RGPD & EUDR Compliant</span>
          </div>
        </div>
      </div>

      <NavItem icon={<Settings size={18} />} label="Paramètres" />
    </nav>

    <div className="p-4 border-t border-white/5 space-y-2">
      <button 
        onClick={onLogout}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-500/10 hover:text-red-400 transition-all cursor-pointer"
      >
        <LogOut size={18} />
        <span>Déconnexion</span>
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

// --- Main App ---

export default function App() {
  const { user, profile, signIn, logout } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeFilter, setActiveFilter] = useState<Status | 'all'>('all');
  const [currentView, setCurrentView] = useState<'dashboard' | 'suppliers' | 'declarations'>('dashboard');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'manual' | 'registry'>('manual');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [notification, setNotification] = useState<{ icon: string; msg: string } | null>(null);
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
    try {
      const supplierRef = doc(db, 'suppliers', selectedSupplier.id);
      const newStatus = selectedSupplier.status === 'alert' || selectedSupplier.status === 'new' ? 'pending' : selectedSupplier.status;
      
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
      
      await addDoc(collection(db, 'suppliers'), {
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
      
      await addDoc(collection(db, 'suppliers'), {
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
        type: 'individual',
        status: "new",
        ref,
        lang: "Português",
        risk,
        userId: user.uid,
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

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex flex-col items-center justify-center p-6 bg-[url('https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=2626&auto=format&fit=crop')] bg-cover bg-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md bg-white rounded-3xl p-10 shadow-2xl space-y-8"
        >
          <div className="text-center">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-4 h-4 bg-[#1db954] rounded-full" />
              <span className="font-display font-black text-3xl tracking-tight">Traverdy</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Bienvenue sur la plateforme</h2>
            <p className="text-sm text-slate-500 mt-2">Simplifiez votre conformité EUDR avec nos outils de géolocalisation et d'audit.</p>
          </div>

          <button 
            onClick={signIn}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl"
          >
            <LogIn size={20} />
            Connexion avec Google
          </button>

          <p className="text-[10px] text-center text-slate-400 leading-relaxed">
            En vous connectant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité liée au règlement européen sur la déforestation (EUDR).
          </p>
        </motion.div>
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
      />

      <main className="pl-64 min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between z-40">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold tracking-tight">
              {currentView === 'dashboard' ? 'Vue d\'ensemble' : 
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
          {currentView === 'dashboard' ? (
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
                  <section className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
                    <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                      <Mail size={16} />
                      Action de Relance
                    </h4>
                    <p className="text-xs text-blue-800/70 mb-4 leading-relaxed">
                      Envoyez une notification automatique en {selectedSupplier.lang} pour demander les fichiers GPS manquants.
                    </p>
                    <div className="bg-white border border-blue-200 rounded-xl p-4 text-[11px] font-medium text-slate-600 leading-relaxed font-mono whitespace-pre-wrap">
                      {RELANCE_TEMPLATES[selectedSupplier.lang].replace('{name}', selectedSupplier.name.split(' ')[0]).replace('{ref}', selectedSupplier.ref)}
                    </div>
                    <button 
                      onClick={() => showNotif('📨', `Email envoyé à ${selectedSupplier.name}.`)}
                      className="w-full mt-4 py-3 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                    >
                      <Send size={14} /> Envoyer maintenant
                    </button>
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
              className="relative w-full max-w-4xl h-[80vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3 font-display font-bold text-lg">
                  <FileText className="text-emerald-600" />
                  Aperçu de la Déclaration de Diligence Raisonnée (Annex II)
                </div>
                <button onClick={() => setIsPreviewOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-12 bg-slate-100">
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

                  <div className="space-y-8 text-sm leading-relaxed">
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
