/** Menu tree mirrors Master Architecture v1.1 §3.1 / §3.2. `phase` marks modules not yet shipped. */
export interface NavItem {
  href: string;
  label: string;
  phase?: 2 | 3 | 4;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const MEMBER_NAV: NavGroup[] = [
  { label: 'Beranda', items: [{ href: '/dashboard', label: 'Ringkasan' }] },
  {
    label: 'Produksi',
    items: [
      { href: '/create-content', label: 'Buat Konten' },
      { href: '/progress', label: 'Progress' },
      { href: '/results', label: 'Hasil' },
    ],
  },
  {
    label: 'Studio',
    items: [
      { href: '/styles', label: 'Galeri Gaya' },
      { href: '/voices', label: 'Suara' },
            { href: '/studio/projects', label: 'Motion Editor & Projects' },
      { href: '/studio/render', label: 'Render Center' },
    ],
  },
  {
    label: 'Pengaturan',
    items: [
      { href: '/settings/claude', label: 'Claude' },
      { href: '/settings/voice-accounts', label: 'Akun Suara' },
      { href: '/settings/brand', label: 'Brand & Akun' },
      { href: '/settings/production', label: 'Produksi' },
      { href: '/settings/license', label: 'Lisensi' },
      { href: '/settings/about', label: 'Tentang' },
    ],
  },
  { label: 'Bantuan', items: [{ href: '/help', label: 'Pusat Bantuan' }] },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Operasional',
    items: [
      { href: '/admin', label: '01 Global Dashboard' },
      { href: '/admin/members', label: '02 Member' },
      { href: '/admin/licenses', label: '03 Lisensi' },
      { href: '/admin/content', label: '04 Content Library' },
      { href: '/admin/voices', label: '05 Voice & TTS' },
      { href: '/admin/ai-providers', label: '06 AI Provider' },
      { href: '/admin/workflows', label: '07 Agent Workflow' },
      { href: '/admin/production', label: '08 Produksi' },
      { href: '/admin/results', label: '09 Hasil & Media' },
      { href: '/admin/quotas', label: '10 Otomasi & Kuota' },
      { href: '/admin/releases', label: '11 Desktop & Rilis' },
      { href: '/admin/support', label: '12 Support' },
      { href: '/admin/analytics', label: '13 Analitik' },
      { href: '/admin/system', label: '14 Sistem & Keamanan' },
    ],
  },
];
