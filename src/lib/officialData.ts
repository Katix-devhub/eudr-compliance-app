export interface HSCode {
  code: string;
  category: string;
  description: string;
}

export const OFFICIAL_HS_CODES: HSCode[] = [
  { code: '0901', category: 'Café', description: 'Café, même torréfié ou décaféiné; coques et pellicules de café.' },
  { code: '1801', category: 'Cacao', description: 'Cacao en fèves et brisures de fèves, bruts ou torréfiés.' },
  { code: '1201', category: 'Soja', description: 'Fèves de soja, même concassées.' },
  { code: '1511', category: 'Huile de palme', description: 'Huile de palme et ses fractions, même raffinées.' },
  { code: '4001', category: 'Caoutchouc', description: 'Caoutchouc naturel et gommes naturelles analogues.' },
  { code: '4403', category: 'Bois', description: 'Bois bruts, même écorcés, désaubiérés ou équarris.' }
];

export const COUNTRY_RISK_BENCHMARK: Record<string, 'low' | 'standard' | 'high'> = {
  'Brésil': 'standard',
  'Indonésie': 'standard',
  'Côte d\'Ivoire': 'standard',
  'Ghana': 'standard',
  'Vietnam': 'standard',
  'Cameroun': 'standard',
  'Colombie': 'low',
  'France': 'low',
  'Allemagne': 'low',
  'Malaisie': 'standard',
  'Nigeria': 'high'
};

export interface OfficialExporter {
  name: string;
  country: string;
  product: string;
  type: string;
}

export const SAMPLE_REAL_EXPORTERS: OfficialExporter[] = [
  { name: 'Cooxupé', country: 'Brésil', product: 'Café', type: 'Coopérative' },
  { name: 'Minasul', country: 'Brésil', product: 'Café', type: 'Coopérative' },
  { name: 'Barry Callebaut Côte d\'Ivoire', country: 'Côte d\'Ivoire', product: 'Cacao', type: 'Exportateur' },
  { name: 'Cargill West Africa', country: 'Côte d\'Ivoire', product: 'Cacao', type: 'Exportateur' },
  { name: 'Ketiara Coffee', country: 'Indonésie', product: 'Café', type: 'Coopérative' },
  { name: 'Musim Mas', country: 'Indonésie', product: 'Huile de palme', type: 'Groupe' },
  { name: 'Sinar Mas', country: 'Indonésie', product: 'Huile de palme', type: 'Groupe' },
  { name: 'COBADE', country: 'Cameroun', product: 'Bois', type: 'Exploitant' }
];

export const COMPLIANCE_METADATA = {
  version: '2.4.0',
  lastUpdate: '2026-04-12',
  regulation: 'EU 2023/1115 (EUDR)',
  status: 'CURRENT'
};

export const OFFICIAL_REGISTRIES = [
  { country: 'Brésil', name: 'MAPA - Registre Agro 2026', url: 'https://www.gov.br/agricultura' },
  { country: 'Indonésie', name: 'GAPKI - Data Center 2026', url: 'https://gapki.id' },
  { country: 'Côte d\'Ivoire', name: 'CCC - Portail Exportateurs', url: 'http://www.conseilcafecacao.ci' },
  { country: 'Europe', name: 'TRACES NT (Commission Européenne)', url: 'https://webgate.ec.europa.eu/tracesnt' },
  { country: 'Global', name: 'Global Forest Watch Monitor', url: 'https://www.globalforestwatch.org/' }
];
