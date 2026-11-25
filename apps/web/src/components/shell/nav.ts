/** Menu tree mirrors Master Architecture v1.1 §3.1 / §3.2. `phase` marks modules not yet shipped. */
export interface NavItem {
  href: string;
  label: string;
  badge?: string;
  phase?: 2 | 3 | 4;
}
export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const MEMBER_NAV: NavGroup[] = [
  { id: 'utama', label: 'UTAMA', items: [{ href: '/dashboard', label: 'Beranda' }] },
  {
    id: 'produksi',
    label: 'PRODUKSI',
    items: [
      { href: '/create-content', label: 'Buat Konten' },
      { href: '/progress', label: 'Progress', badge: 'LIVE' },
      { href: '/results', label: 'Hasil' },
    ],
  },
  {
    id: 'studio',
    label: 'STUDIO',
    items: [
      { href: '/styles', label: 'Galeri Gaya' },
      { href: '/voices', label: 'Suara' },
      { href: '/studio/projects', label: 'Motion Editor' },
      { href: '/studio/render', label: 'Render Center' },
    ],
  },
  {
    id: 'pengaturan',
    label: 'PENGATURAN',
    items: [
      { href: '/settings/claude', label: 'Koneksi Claude AI' },
      { href: '/settings/voice-accounts', label: 'Akun Suara' },
      { href: '/settings/brand', label: 'Brand & Akun' },
      { href: '/settings/production', label: 'Produksi Otomatis' },
      { href: '/settings/license', label: 'Lisensi Saya' },
      { href: '/settings/about', label: 'Tentang & Unduh Desktop' },
      { href: '/help', label: 'Bantuan & FAQ' },
    ],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    id: 'admin-core',
    label: 'CONTROL CENTER',
    items: [
      { href: '/admin', label: '01 Control Center' },
      { href: '/admin/members', label: '02 Member & Akses' },
      { href: '/admin/licenses', label: '03 Lisensi & Device' },
    ],
  },
  {
    id: 'admin-catalog',
    label: 'KATALOG & AI',
    items: [
      { href: '/admin/content', label: '04 Content Library' },
      { href: '/admin/content/import', label: '04b Import Folder' },
      { href: '/admin/voices', label: '05 Voice & TTS' },
      { href: '/admin/ai-providers', label: '06 AI Provider' },
      { href: '/admin/workflows', label: '07 Agent Workflow' },
    ],
  },
  {
    id: 'admin-ops',
    label: 'OPERASIONAL',
    items: [
      { href: '/admin/production', label: '08 Produksi' },
      { href: '/admin/results', label: '09 Hasil & Media' },
      { href: '/admin/quotas', label: '10 Kuota & Limit' },
      { href: '/admin/releases', label: '11 Rilis Desktop' },
      { href: '/admin/support', label: '12 Tiket Support' },
      { href: '/admin/analytics', label: '13 Analitik & Error' },
      { href: '/admin/system', label: '14 Sistem & VPS' },
      { href: '/admin/office', label: '15 Kantor & RBAC' },
    ],
  },
];
