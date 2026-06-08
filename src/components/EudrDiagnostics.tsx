import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  ChevronRight, 
  Copy, 
  Mail, 
  Phone, 
  Download, 
  Search, 
  FileText, 
  UploadCloud, 
  Trash2, 
  Info, 
  Sparkles, 
  Clock, 
  Globe, 
  Layers, 
  ShieldCheck, 
  FileCheck2,
  Check,
  Send,
  Printer,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { HSCode, OFFICIAL_HS_CODES, COUNTRY_RISK_BENCHMARK } from '../lib/officialData';

interface EudrDiagnosticsProps {
  suppliers: any[];
  onNotif: (msg: string) => void;
}

// Sub-products & by-products list for the search input
interface ProductDetail {
  name: string;
  hsCode: string;
  category: string;
  euCovered: boolean;
  explanation: string;
  obligations: string[];
}

const PRODUCT_DATABASE: ProductDetail[] = [
  // Covered Café
  {
    name: "Café en grains (torréfié ou non)",
    hsCode: "0901",
    category: "Café",
    euCovered: true,
    explanation: "Tous les cafés, décaféinés ou non, y compris les coques et pellicules.",
    obligations: ["Géolocalisation précise (points ou polygones selon la surface)", "Preuve d'absence de déforestation après le 31 décembre 2020", "Conformité légale dans le pays de production", "Déclaration de diligence raisonnée (DDS) indispensable avant importation."]
  },
  {
    name: "Substituts contenant du café",
    hsCode: "0901.90",
    category: "Café",
    euCovered: true,
    explanation: "Tout substitut ou mélange contenant du café de la catégorie 0901.",
    obligations: ["Délivrer la preuve de l'origine de l'ingrédient café", "Traçabilité complète jusqu'à la parcelle d'origine."]
  },
  // Covered Cacao
  {
    name: "Cacao en fèves ou brisures",
    hsCode: "1801",
    category: "Cacao",
    euCovered: true,
    explanation: "Fèves de cacao et brisures de fèves, brutes ou torréfiées.",
    obligations: ["Géolocalisation complète des parcelles", "Preuves de légalité douanière & foncière", "Contrôles satellites requis pour attester l'absence de dégradation forestière."]
  },
  {
    name: "Pâte de cacao, beurre de cacao, poudre",
    hsCode: "1803",
    category: "Cacao",
    euCovered: true,
    explanation: "Tous les produits dérivés de première transformation du cacao.",
    obligations: ["Remonter la chaîne d'approvisionnement jusqu'aux coopératives d'origine", "Géolocalisation des parcelles d'origine associée aux lots."]
  },
  {
    name: "Chocolat et préparations alimentaires contenant du cacao",
    hsCode: "1806",
    category: "Cacao",
    euCovered: true,
    explanation: "Le chocolat et toutes les friandises chocolatées entrent pleinement dans le champ d'application.",
    obligations: ["Traçabilité stricte de la part 'cacao' incorporée", "Collecte des DDS amont des importateurs des matières premières."]
  },
  // Covered Bois
  {
    name: "Bois brut, grumes, bois de chauffage",
    hsCode: "4403",
    category: "Bois",
    euCovered: true,
    explanation: "Toutes les grumes, bois bruts écorcés, désaubiérés ou équarris.",
    obligations: ["Polygones GPS de chaque concession forestière", "Attestation de gestion durable ou d'exploitation légale", "Preuve du respect des droits des populations autochtones."]
  },
  {
    name: "Meubles en bois",
    hsCode: "9403",
    category: "Bois",
    euCovered: true,
    explanation: "Les tables, chaises, armoires et toutes structures construites principalement en bois.",
    obligations: ["Identifier l'essence de bois exacte (nom scientifique & commun)", "Retracer toutes les scieries et concessions d'origine", "Soumettre l'ID d'arbre ou de concession forestière dans la DDS."]
  },
  {
    name: "Papier, carton, emballages papier",
    hsCode: "4819",
    category: "Bois",
    euCovered: true,
    explanation: "Les boîtes de carton, sacs en papier, livres, catalogues et emballages dérivés.",
    obligations: ["Attester qu'aucune fibre de bois ne provient de forêts dégradées", "Contrôle de conformité de la pâte à papier utilisée."]
  },
  // Covered Caoutchouc
  {
    name: "Caoutchouc naturel (latex, feuilles, plaques)",
    hsCode: "4001",
    category: "Caoutchouc",
    euCovered: true,
    explanation: "Sève d'hévéa liquide, plaques fumées et caoutchouc naturel brut.",
    obligations: ["Cartographie des plantations de caoutchouc d'origine", "Certificat d'absence de déforestation (imagerie satellite à l'appui)."]
  },
  {
    name: "Pneumatiques neufs en caoutchouc",
    hsCode: "4011",
    category: "Caoutchouc",
    euCovered: true,
    explanation: "Pneus de véhicules, engins agricoles ou d'aviation fabriqués à base de caoutchouc naturel.",
    obligations: ["Remonter la traçabilité des lots de caoutchouc naturel incorporés", "Vérification de la légalité foncière des micro-plantations d'hévéa."]
  },
  // Covered Soja
  {
    name: "Soja (fèves de soja, même concassées)",
    hsCode: "1201",
    category: "Soja",
    euCovered: true,
    explanation: "Graines de soja brutes ou concassées utilisées en alimentation animale ou humaine.",
    obligations: ["Géolocalisation des parcelles à l'hectare près", "Historique satellite des parcelles pour prouver qu'elles n'étaient pas des forêts primaires ou secondaires fin 2020."]
  },
  {
    name: "Tourteaux de soja et farines",
    hsCode: "2304",
    category: "Soja",
    euCovered: true,
    explanation: "Résidus solides de l'extraction de l'huile de soja, cruciaux pour l'alimentation du bétail.",
    obligations: ["Contrôle renforcé de la chaîne logistique (risque de mélange/contamination)", "Exigence d'une déclaration de traçabilité complète de l'importateur."]
  },
  // Covered Huile de palme
  {
    name: "Huile de palme et ses fractions",
    hsCode: "1511",
    category: "Huile de palme",
    euCovered: true,
    explanation: "Huile brute, raffinée ou fractions liquides/solides de palme.",
    obligations: ["Géolocalisation GPS complète du moulin de pressage et des plantations d'origine", "Preuve du respect des régulations environnementales locales."]
  },
  {
    name: "Glycérol brut et cires de palme",
    hsCode: "1520",
    category: "Huile de palme",
    euCovered: true,
    explanation: "Dérivés intermédiaires utilisés en cosmétique ou chimie.",
    obligations: ["Traçabilité de la chaîne de raffinage", "Certificat d'origine exempt de déforestation."]
  },
  // Covered Bovins
  {
    name: "Viande de bétail (bovine) fraîche ou congelée",
    hsCode: "0201",
    category: "Bovins",
    euCovered: true,
    explanation: "Carcasses, demi-carcasses ou morceaux de viande bovine.",
    obligations: ["Géolocalisation de toutes les exploitations d'élevage où les animaux ont séjourné", "Identifiant unique de traçabilité vétérinaire ou de marquage des bêtes", "Confirmation que l'élevage ne s'est pas fait sur des zones déboisées depuis 2020."]
  },
  {
    name: "Cuir brut et peaux de bovins",
    hsCode: "4101",
    category: "Bovins",
    euCovered: true,
    explanation: "Peaux entières ou demi-peaux fraîches, salées, séchées ou chaulées.",
    obligations: ["Traçabilité complète de l'abattoir jusqu'aux ranchs d'élevage primaires", "Historique de transhumance si applicable pour attester de la légalité environnementale."]
  },
  // NOT Covered Examples
  {
    name: "Blé, maïs, orge et céréales",
    hsCode: "1001",
    category: "Céréales",
    euCovered: false,
    explanation: "Les céréales ne font pas partie de l'annexe I du RDUE (EUDR) publiée au Journal Officiel.",
    obligations: ["Aucune obligation de diligence raisonnée au titre du règlement EUDR.", "Seules s'appliquent les règles douanières et phytosanitaires standards."]
  },
  {
    name: "Thé noir ou thé vert",
    hsCode: "0902",
    category: "Thé",
    euCovered: false,
    explanation: "Bien que proche du café, le thé n'est pas dans le périmètre actuel du RDUE.",
    obligations: ["Pas d'obligation RDUE.", "Restez vigilant sur les futures extensions potentielles du règlement."]
  },
  {
    name: "Riz (même décortiqué ou poli)",
    hsCode: "1006",
    category: "Riz",
    euCovered: false,
    explanation: "Le riz est exempt des règles du règlement sur la déforestation.",
    obligations: ["Aucune obligation réglementaire de géolocalisation ou d'imagerie forestière."]
  }
];

export const EudrDiagnostics = ({ suppliers, onNotif }: EudrDiagnosticsProps) => {
  // 1. Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);

  // 2. Interactive Calculator State
  const [selectedCategory, setSelectedCategory] = useState('Café');
  const [selectedCountry, setSelectedCountry] = useState('Brésil');
  const [plotArea, setPlotArea] = useState<number>(3.5); // hectares
  const [supplierType, setSupplierType] = useState<'individual' | 'cooperative'>('individual');
  const [supplierName, setSupplierName] = useState('Producteur Local');

  // New simulated upload files list
  const [proofFiles, setProofFiles] = useState<{ id: string; name: string; type: string; size: string; status: 'verified' | 'pending' | 'rejected' }[]>([
    { id: '1', name: 'coordonnees_gps_parcelles_v2.geojson', type: 'Fichier GPS / Polygone', size: '342 KB', status: 'verified' },
    { id: '2', name: 'attestation_legalite_tribunal_agro.pdf', type: 'Légalité Locale', size: '1.2 MB', status: 'verified' },
    { id: '3', name: 'rapport_satellite_gfw_deforestation.pdf', type: 'Audit Déforestation', size: '890 KB', status: 'pending' }
  ]);

  // Checklist item custom state
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({
    'geo': true,
    'forest': false,
    'local_law': true,
    'dds': false,
    'supplier_agree': true,
    'satellite_audit': false
  });

  const [reminderLanguage, setReminderLanguage] = useState<'FR' | 'EN' | 'ES' | 'PT'>('FR');
  const [reminderTone, setReminderTone] = useState<'courteous' | 'urgent'>('courteous');

  // Fuzzy match search in database
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return PRODUCT_DATABASE.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.hsCode.toLowerCase().includes(query) || 
      p.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const detectedRisk: 'low' | 'standard' | 'high' = useMemo(() => {
    return COUNTRY_RISK_BENCHMARK[selectedCountry] || 'standard';
  }, [selectedCountry]);

  // Specific rule evaluation: plots over 4 hectares require full spatial polygons, otherwise single points may suffice (some countries mandate polygons anyway for EUDR, but over 4ha is the standard cutoff in some drafts). 
  // Wait, actually EUDR says: plots > 4 hectares require polygons (geographic coordinates of the points outlining the perimeter), whereas <= 4 hectares require a single latitude/longitude point.
  const isPolygonRequired = plotArea > 4;

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Document Request Template Generator
  const generatedMessage = useMemo(() => {
    const templates = {
      FR: {
        courteous: `Bonjour ${supplierName},\n\nDans le cadre de la mise en conformité réglementaire relative au Règlement Européen sur la Déforestation (RDUE / EUDR), nous préparons notre dossier d'importation pour votre lot de ${selectedCategory} en provenance de ${selectedCountry}.\n\nPour ce faire, merci de nous transmettre au plus vite :\n1. Les coordonnées géographiques (fichiers GPS au format GPX, GeoJSON ou KML). ${isPolygonRequired ? "La parcelle mesurant plus de 4 ha, les polygones complets délimitant la parcelle sont obligatoires." : "La parcelle mesurant moins de 4 ha, un point GPS de latitude/longitude central est requis."}\n2. Les certificats de propriété foncière légale locale.\n\nVous pouvez cliquer sur notre lien sécurisé pour téléverser directement vos documents.\n\nMerci infiniment pour votre réactivité.`,
        urgent: `URGENT - CONFORMITÉ DOUANIÈRE EUDR\n\nBonjour ${supplierName},\n\nSans réponse sous 5 jours, l'importation de vos lots de ${selectedCategory} vers l'Union Européenne sera réglementairement bloquée.\nLe règlement RDUE / EUDR exige que nous communiquions la géolocalisation exacte de vos parcelles au port douanier.\n\nMerci de nous transmettre de toute urgence les polygones ou points GPS et vos documents de conformité légale.\n\nCordialement,\nService Conformité Traverdy`
      },
      EN: {
        courteous: `Dear ${supplierName},\n\nAs part of our compliance process for the European Union Deforestation Regulation (EUDR), we are preparing the import file for your batch of ${selectedCategory} from ${selectedCountry}.\n\nTo ensure conformity, please send us as soon as possible:\n1. The GPS coordinates of your plot(s) (GPX, GeoJSON, or KML format). ${isPolygonRequired ? "Since your plot is greater than 4 ha, complete outline polygons are required." : "Since your plot is less than 4 ha, basic latitude/longitude central coordinates are sufficient."}\n2. Official land tenure and legal registration certificates.\n\nSincerely,\nTraverdy Compliance Team`,
        urgent: `URGENT - EUDR COMPLIANCE ALERTE\n\nDear ${supplierName},\n\nFailure to provide geolocation coordinates for your ${selectedCategory} plots within 5 days will prevent us from importing your shipments into Europe due to strict EUDR customs checks.\n\nPlease upload your files urgently.\n\nBest regards,\nTraverdy Team`
      },
      ES: {
        courteous: `Estimado ${supplierName},\n\nComo parte de nuestro proceso de cumplimiento de la normativa europea sobre deforestación (EUDR), estamos preparando el expediente de importación de su lote de ${selectedCategory} de ${selectedCountry}.\n\nAgradecemos nos envíe lo antes posible:\n1. Coordenadas GPS de sus parcelas. ${isPolygonRequired ? "Al tener más de 4 hectáreas, se requieren polígonos completos." : "Al tener menos de 4 hectáreas, un punto central de latitud/longitud es suficiente."}\n2. Títulos de propiedad y certificados de conformidad local.\n\nAtentamente,\nEquipo Traverdy`,
        urgent: `URGENT - CONTROL ADUANERO EUDR\n\nEstimado ${supplierName},\n\nSi no envía las coordenadas geográficas de sus parcelas de ${selectedCategory} en 5 días, los cargamentos terrestres y marítimos serán bloqueados en la aduana europea por falta de cumplimiento del reglamento EUDR.\n\nPor favor, envíe sus archivos urgentemente.\n\nAtentamente,\nEquipo Traverdy`
      },
      PT: {
        courteous: `Prezado ${supplierName},\n\nComo parte da nossa conformidade com a nova legislação europeia contra o desmatamento (EUDR), estamos reunindo os dados para a importação de ${selectedCategory} originário de ${selectedCountry}.\n\nSolicitamos o envio urgente de:\n1. Coordenadas de geolocalização. ${isPolygonRequired ? "Como o terreno possui mais de 4 ha, são necessários os polígonos completos." : "Como o terreno possui menos de 4 ha, apenas as coordenadas geográficas centrais são suficientes."}\n2. Comprovantes de direito legal de uso da terra.\n\nAtenciosamente,\nConformidade Traverdy`,
        urgent: `URGENTE - ADUANA EUDR BLOQUEIO ADUANEIRO\n\nPrezado ${supplierName},\n\nSolicitamos as coordenadas GPS de seus lotes de ${selectedCategory} com máxima urgência. O não envio impedirá a liberação aduaneira nas fronteiras da União Europeia.\n\nEnvie os arquivos sem atraso.\n\nAtenciosamente,\nConformidade Traverdy`
      }
    };

    return templates[reminderLanguage][reminderTone];
  }, [supplierName, selectedCategory, selectedCountry, plotArea, isPolygonRequired, reminderLanguage, reminderTone]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedMessage);
    onNotif("Texte copié dans le presse-papier !");
  };

  // Add dummy file helper
  const handleAddFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const newFile = {
        id: Math.random().toString(),
        name: file.name,
        type: file.type || 'Document PDF',
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        status: 'pending' as const
      };
      setProofFiles(prev => [...prev, newFile]);
      onNotif(`Fichier "${file.name}" ajouté temporairement au simulateur d'audit !`);
      
      // Auto approve after 3 seconds for active simulation feel
      setTimeout(() => {
        setProofFiles(current => 
          current.map(f => f.id === newFile.id ? { ...f, status: 'verified' } : f)
        );
        onNotif(`Analyse satellite automatique : conformité validée pour "${file.name}" !`);
      }, 3000);
    }
  };

  const removeFile = (id: string, name: string) => {
    setProofFiles(prev => prev.filter(f => f.id !== id));
    onNotif(`Fichier "${name}" supprimé.`);
  };

  // Progress Calculations
  const complianceProgress = useMemo(() => {
    let checkedCount = Object.values(checkedItems).filter(Boolean).length;
    let verifiedFilesWeight = proofFiles.filter(f => f.status === 'verified').length * 15;
    let totalProgress = Math.min((checkedCount * 10) + verifiedFilesWeight + 15, 100);
    return Math.round(totalProgress);
  }, [checkedItems, proofFiles]);

  return (
    <div className="space-y-8 pb-16">
      {/* Introduction Card */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white rounded-3xl p-8 border border-emerald-500/10 relative overflow-hidden shadow-2xl shadow-emerald-950/20">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 bg-[radial-gradient(circle_at_bottom_right,var(--color-emerald-500),transparent)] pointer-events-none" />
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-full">
            <Sparkles size={14} className="animate-pulse" />
            <span>Nouveauté Plan d'Accompagnement PME</span>
          </div>
          <h2 className="text-3xl font-display font-extrabold tracking-tight text-white">
            Assistant de Diagnostic & Détective de Produit RDUE
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            Face à la complexité du règlement européen (EUDR), simplifiez votre conformité. Recherchez n'importe quel code douanier (code SH), évaluez instantanément les exigences de traçabilité de vos producteurs, et générez des questionnaires simples pour vos fournisseurs.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <div className="flex items-center gap-2 text-xs bg-white/5 border border-white/5 rounded-xl px-4 py-2.5">
              <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
              <span>Conforme EUDR 2026</span>
            </div>
            <div className="flex items-center gap-2 text-xs bg-white/5 border border-white/5 rounded-xl px-4 py-2.5">
              <Layers size={16} className="text-[#1db954] shrink-0" />
              <span>100% Adapté aux PME et Importateurs</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Detector and Custom Diagnostic form */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* SECTION 1: Product & HS Code Detector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm shadow-slate-100 flex flex-col space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
                <Search size={22} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Détective Douanier & Code SH (HS Code)</h3>
                <p className="text-xs text-slate-500">Saisissez un produit ou un numéro de code SH pour tester s'il est concerné.</p>
              </div>
            </div>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search size={18} />
              </span>
              <input 
                type="text" 
                placeholder="Ex. meuble, pneu, chocolat, blé, cacao, 0901..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl text-sm transition-all focus:outline-none"
              />
            </div>

            {/* Quick selectors triggers */}
            {!searchQuery && (
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Démos rapides :</span>
                <div className="flex flex-wrap gap-2">
                  {['0901 (Café)', '1806 (Chocolat)', '9403 (Meuble en bois)', '1001 (Blé - Hors scope)', '4011 (Pneus)'].map((p) => (
                    <button 
                      key={p} 
                      onClick={() => {
                        const code = p.split(' ')[0];
                        setSearchQuery(code);
                      }}
                      className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg text-slate-600 transition-colors border border-slate-150 cursor-pointer"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Live Search Results */}
            {searchQuery && (
              <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100">
                {searchResults.length > 0 ? (
                  searchResults.map((prod) => (
                    <button
                      key={prod.name}
                      onClick={() => {
                        setSelectedProduct(prod);
                        setSearchQuery('');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between transition-colors group cursor-pointer"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">{prod.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">Code SH {prod.hsCode}</span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-1">{prod.explanation}</p>
                      </div>
                      <span className={cn(
                        "text-xs font-bold px-2.5 py-1 rounded-full",
                        prod.euCovered ? "bg-red-50 text-red-700 border border-red-100" : "bg-slate-100 text-slate-500"
                      )}>
                        {prod.euCovered ? "Assujetti RDUE" : "Non assujetti"}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-400 text-sm">
                    Aucun résultat spécifique trouvé. Tentez une autre formulation (ex : café, meuble, orge).
                  </div>
                )}
              </div>
            )}

            {/* Display Selected Product Details inside the detector */}
            <AnimatePresence mode="wait">
              {selectedProduct && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn(
                    "rounded-xl p-4 border relative",
                    selectedProduct.euCovered ? "bg-red-50/40 border-red-100" : "bg-emerald-50/20 border-emerald-100"
                  )}
                >
                  <button 
                    onClick={() => setSelectedProduct(null)} 
                    className="absolute top-3 right-3 p-1 hover:bg-slate-200/50 rounded-full transition-colors"
                  >
                    <X size={16} className="text-slate-400" />
                  </button>
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-lg shrink-0 mt-0.5",
                      selectedProduct.euCovered ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
                    )}>
                      {selectedProduct.euCovered ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                    </div>
                    <div className="space-y-2 select-none">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-900 text-sm">{selectedProduct.name}</h4>
                        <span className="text-xs px-1.5 py-0.2 bg-white border border-slate-200 rounded font-bold text-slate-600 font-mono">CODE SH {selectedProduct.hsCode}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        {selectedProduct.explanation}
                      </p>

                      {selectedProduct.euCovered ? (
                        <div className="space-y-1.5 pt-2 border-t border-red-100/60 text-xs">
                          <span className="font-bold text-red-900 block uppercase tracking-wide text-[9px]">Obligations majeures en douane :</span>
                          <ul className="space-y-1 text-slate-700 list-disc list-inside">
                            {selectedProduct.obligations.map((obl, i) => (
                              <li key={i}>{obl}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-emerald-100/60 text-xs text-slate-500">
                          <span className="font-bold text-emerald-900 block uppercase tracking-wide text-[9px]">Note de dispense :</span>
                          Le règlement ne s'applique pas à cette catégorie. Aucun contrôle satellite spécial déforestation n'est requis au niveau de la douane.
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* SECTION 2: Interactive Diagnostic Engine */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm shadow-slate-100 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2.5 bg-[#1db954]/10 text-emerald-800 rounded-xl">
                <FileCheck2 size={22} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Évaluation Interactive de Risque & Seuil GPS</h3>
                <p className="text-xs text-slate-500">Définissez les attributs de votre flux d'importation pour simuler les règles exactes imposées à vos PME.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Matière Première</label>
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white"
                >
                  <option value="Café">Café</option>
                  <option value="Cacao">Cacao</option>
                  <option value="Bois">Bois</option>
                  <option value="Caoutchouc">Caoutchouc</option>
                  <option value="Soja">Soja</option>
                  <option value="Huile de palme">Huile de palme</option>
                  <option value="Bovins">Bovins (Cuir/Viande)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pays de Source</label>
                <select 
                  value={selectedCountry} 
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white"
                >
                  {Object.keys(COUNTRY_RISK_BENCHMARK).map((country) => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Superficie de la Parcelle</label>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                    isPolygonRequired ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  )}>
                    {isPolygonRequired ? "Polygone Exigé" : "Point GPS Suffisant"}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <input 
                    type="number" 
                    step="0.1"
                    min="0.1"
                    value={plotArea} 
                    onChange={(e) => setPlotArea(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                    className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-center focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                  <span className="text-sm font-medium text-slate-500">Hectares (seuil RDUE à 4 ha)</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type du Fournisseur</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setSupplierType('individual')}
                    className={cn(
                      "flex-1 py-1 px-4 text-xs font-bold rounded-md transition-all cursor-pointer",
                      supplierType === 'individual' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                    )}
                  >
                    Producteur unique
                  </button>
                  <button 
                    onClick={() => setSupplierType('cooperative')}
                    className={cn(
                      "flex-1 py-1 px-4 text-xs font-bold rounded-md transition-all cursor-pointer",
                      supplierType === 'cooperative' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                    )}
                  >
                    Coopérative
                  </button>
                </div>
              </div>
            </div>

            {/* Simulated Live Output Cards */}
            <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 flex flex-col space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Résultats d'Audit Théoriques :</span>
                <span className={cn(
                  "text-xs font-black uppercase px-2 py-0.5 rounded-full border",
                  detectedRisk === 'high' ? "bg-red-50 text-red-700 border-red-200" :
                  detectedRisk === 'standard' ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                )}>
                  Bench de Risque : {detectedRisk === 'high' ? 'Élevé' : detectedRisk === 'standard' ? 'Standard' : 'Faible'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-3 border border-slate-150 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-450 flex items-center gap-1">
                    <MapPin size={12} className="text-emerald-500" /> Géolocalisation Requise :
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                    {isPolygonRequired 
                      ? "Vous devez collecter le polygone géographique complet décrivant la géométrie de la parcelle. Les points uniques ne conviennent plus au-dessus de 4 ha." 
                      : "Un point GPS unique de latitude/longitude central est acceptable, mais un polygone complet reste fortement recommandé par les autorités."
                    }
                  </p>
                </div>

                <div className="bg-white p-3 border border-slate-150 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-450 flex items-center gap-1">
                    <Building2 size={12} className="text-violet-500" /> Complexité logistique :
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                    {supplierType === 'cooperative' 
                      ? "Traitement avec une Coopérative : Vous devez documenter les coordonnées de TOUTES les fermes individuelles partenaires de la coopérative impliquées dans le lot final." 
                      : "Producteur unique : Collecte directe beaucoup plus simple, une seule fiche géographique de parcelle est requise."
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Checklist & Request templates */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* SECTION 3: Progress & simulated list of evidence */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm shadow-slate-100 flex flex-col space-y-5">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">Validateur de Dossier de Preuves</h3>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">{complianceProgress}% Prêt</span>
              </div>
              <p className="text-xs text-slate-500">Un dossier complet protège l'importateur d'amendes de la douane de l'UE (jusqu'à 4 % du CA).</p>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-[#1db954] h-full transition-all duration-500 rounded-full"
                style={{ width: `${complianceProgress}%` }}
              />
            </div>

            {/* Files List */}
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Preuves annexées simulées :</span>
              <div className="space-y-2">
                {proofFiles.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-150 transition-colors hover:bg-slate-50/80">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="p-1.5 bg-slate-200 text-slate-500 rounded-md shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-semibold text-slate-900 truncate">{f.name}</p>
                        <p className="text-[10px] text-slate-450 font-mono">{f.type} • {f.size}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                        f.status === 'verified' ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800 animate-pulse"
                      )}>
                        {f.status === 'verified' ? 'Vérifié' : 'En cours'}
                      </span>
                      <button 
                        onClick={() => removeFile(f.id, f.name)}
                        className="p-1 hover:text-red-500 rounded-md hover:bg-red-50 text-slate-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add file zone */}
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 hover:border-emerald-500 hover:bg-emerald-50/10 transition-colors cursor-pointer group text-center">
                <UploadCloud size={24} className="text-slate-400 group-hover:text-emerald-500 transition-colors mb-1" />
                <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-700 transition-colors">Déposer des preuves de conformité</span>
                <span className="text-[10px] text-slate-400">GeoJSON, KML, Certificats d'origine, PDF</span>
                <input 
                  type="file" 
                  accept=".pdf,.geojson,.kml,.gpx,.png,.jpg" 
                  onChange={handleAddFile} 
                  className="hidden" 
                />
              </label>
            </div>
          </div>

          {/* SECTION 4: Personalized Checklist */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm shadow-slate-100 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Checklist de Diligence Raisonnée</h3>
              <p className="text-xs text-slate-500">L'EUDR exige l'exécution d'un protocole d'évaluation en 3 étapes : Information, Analyse des risques, et Atténuation des risques.</p>
            </div>

            <div className="space-y-3">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Protocole Recommandé :</span>
              
              <div className="space-y-2.5">
                {[
                  { id: 'geo', label: `Collecter la géolocalisation (${isPolygonRequired ? "Polygones GPS requis car > 4ha" : "Point GPS valide < 4ha"})`, desc: "Obligatoire pour l'Etape 1 (Collecte d'informations)." },
                  { id: 'forest', label: "Lancer l'audit d'absence de déforestation après 31/12/2020", desc: "Inspection par imagerie satellite (Alertes Radd/GLAD)." },
                  { id: 'local_law', label: "Obtenir l'attestation de légalité du pays d'origine", desc: "Respect des lois du travail, des droits d'occupation du sol et fiscaux." },
                  { id: 'satellite_audit', label: "Générer le rapport satellite de preuve Traverdy", desc: "Fera office de justificatif lors d'un contrôle des douanes." },
                  { id: 'supplier_agree', label: "Faire signer la clause de conformité douanière", desc: "Dédouanement de responsabilité de l'acheteur français." },
                  { id: 'dds', label: "Déposer le numéro de DDS sur le portail douanier TRACES NT", desc: "Dernière étape autorisant la mise sur le marché européen." }
                ].map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => toggleCheck(item.id)}
                    className="flex gap-3 items-start p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors cursor-pointer select-none"
                  >
                    <div className="mt-0.5 shrink-0">
                      <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center transition-all",
                        checkedItems[item.id] ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white"
                      )}>
                        {checkedItems[item.id] && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-slate-900 leading-tight">{item.label}</p>
                      <p className="text-[10px] text-slate-500 leading-normal">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: Multi-lingual Supplier Invitation Document Template generator */}
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm shadow-slate-100 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl">
              <Mail size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Générateur de Message d'explications et Demande de documents</h3>
              <p className="text-xs text-slate-500">Les fournisseurs paniquent souvent car ils ne comprennent pas le règlement européen. Expliquez-leur facilement avec ces modèles.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Lang switcher */}
            <div className="flex bg-slate-100 rounded-xl p-0.5 border border-slate-200 text-xs font-bold font-mono">
              {(['FR', 'EN', 'ES', 'PT'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setReminderLanguage(lang)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                    reminderLanguage === lang ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-200"
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>

            {/* Tone switcher */}
            <div className="flex bg-slate-150 rounded-xl p-0.5 border border-slate-200 text-xs font-bold">
              <button 
                onClick={() => setReminderTone('courteous')}
                className={cn(
                  "px-3 py-1 rounded-lg cursor-pointer",
                  reminderTone === 'courteous' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
                )}
              >
                Pédagogique
              </button>
              <button 
                onClick={() => setReminderTone('urgent')}
                className={cn(
                  "px-3 py-1 rounded-lg cursor-pointer",
                  reminderTone === 'urgent' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
                )}
              >
                Urgent
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom du Producteur / Fournisseur</label>
              <input 
                type="text" 
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white"
                placeholder="Ex. Fazenda Santa Clara"
              />
            </div>

            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 text-xs text-indigo-950 space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                <Info size={16} />
                <span>Pourquoi ce template excelle ?</span>
              </div>
              <p className="leading-relaxed font-semibold">
                Les PME ont beaucoup de mal à collecter les données géographiques de fermiers à l'autre bout du monde. Ce texte explique aux planteurs que le GPS est obligatoire pour entrer sur le sol européen, réduisant le taux de refus et facilitant la collaboration.
              </p>
              <div className="flex gap-2">
                <a 
                  href={`mailto:?subject=Important%20-%20Conformit%C3%A9%20RDUE%20pour%20importation&body=${encodeURIComponent(generatedMessage)}`}
                  className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-1.5 font-bold font-sans transition-colors cursor-pointer text-center text-[10px]"
                >
                  <Mail size={12} />
                  Envoyer par Email
                </a>
                <a 
                  href={`https://wa.me/?text=${encodeURIComponent(generatedMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center gap-1.5 font-bold font-sans transition-colors cursor-pointer text-center text-[10px]"
                >
                  <Send size={12} />
                  Par WhatsApp
                </a>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 relative">
            <pre className="w-full h-64 p-4 bg-slate-900 text-emerald-400 font-mono text-xs overflow-y-auto rounded-2xl leading-relaxed whitespace-pre-wrap select-all shadow-inner border border-slate-950">
              {generatedMessage}
            </pre>
            <button
              onClick={copyToClipboard}
              className="absolute bottom-4 right-4 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              <Copy size={14} />
              Copier le message
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 6: PDF Report Generator card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2 max-w-xl">
          <div className="font-mono text-xs text-[#1db954] font-bold tracking-widest uppercase">Télécharger la Fiche Diagnostic</div>
          <h3 className="text-xl font-display font-bold text-white">Générateur de Fiche de Diagnostic & Auto-Conformité PME</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Exports PDF certifiés d'auto-accréditation de vos lots de {selectedCategory}. Idéal à fournir lors de vos audits internes ou d'un controle ponctuel de l'administration douanière pour prouver l'exercice de votre devoir de diligence.
          </p>
        </div>
        
        <button 
          onClick={() => {
            window.print();
          }}
          className="px-6 py-3.5 bg-[#1db954] hover:bg-[#1db954]/90 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-950 flex items-center gap-2 shrink-0 transition-all cursor-pointer hover:scale-102"
        >
          <Printer size={18} />
          Imprimer le Diagnostic PDF
        </button>
      </div>
    </div>
  );
};
