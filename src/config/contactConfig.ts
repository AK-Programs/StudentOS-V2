/**
 * VEYLENTRA — Centralized Contact & Credits Configuration
 * 
 * Strict Single Source of Truth for the "About Veylentra" page.
 * Contains only verified contact details and clearly labelled, easy-to-edit placeholders.
 * 
 * Rules:
 * - Unverified or missing info must have `isConfigured: false` (will be displayed with a placeholder tag, not clickable).
 * - Verified information has `isConfigured: true` and will have active clickable links (mailto, tel, https).
 */

export interface ContactChannel {
  id: string;
  category: 'email' | 'website' | 'support' | 'phone' | 'social';
  label: string;
  value: string;
  actionUrl?: string;
  isConfigured: boolean;
  statusBadge?: string;
  iconName: 'Mail' | 'Globe' | 'Headphones' | 'Phone' | 'Share2' | 'MessageSquare';
}

export interface ProfileCredit {
  id: string;
  name: string;
  role: string;
  title: string;
  isFounder?: boolean;
  email?: string;
  avatarUrl?: string;
  badge: string;
  isPlaceholder?: boolean;
}

export interface ContactConfig {
  founder: ProfileCredit;
  teamCredits: ProfileCredit[];
  channels: ContactChannel[];
  lastUpdated: string;
}

export const CONTACT_CONFIG: ContactConfig = {
  lastUpdated: 'October 2026',
  
  // Founder Profile
  founder: {
    id: 'founder-naitik',
    name: 'Naitik Kashyap',
    role: 'Founder of Veylentra',
    title: 'Founder & Principal Platform Architect',
    isFounder: true,
    email: 'naitik.kashyap0015@gmail.com',
    badge: 'Founder & Architect'
  },

  // Credits Area: Team Members & Owner Profiles with Roles
  teamCredits: [
    {
      id: 'member-founder',
      name: 'Naitik Kashyap',
      role: 'Founder & Lead Architect',
      title: 'Platform Architecture, Core Full-Stack & AI Systems',
      isFounder: true,
      email: 'naitik.kashyap0015@gmail.com',
      badge: 'Owner / Founder'
    },
    {
      id: 'member-platform-eng',
      name: 'Core Platform Engineering',
      role: 'Platform Engineering & Cloud Infrastructure',
      title: 'Realtime Sync, Supabase Integration & Security Hardening',
      badge: 'Systems Team',
      isPlaceholder: true
    },
    {
      id: 'member-academic-ops',
      name: 'Academic Operations & Curriculum',
      role: 'Curriculum & Institutional Workflows',
      title: 'Digital Gradebooks, Attendance Protocols & Timetable Scheduling',
      badge: 'Academic Team',
      isPlaceholder: true
    },
    {
      id: 'member-experience',
      name: 'Student Experience & Community',
      role: 'Design, Accessibility & Campus Community',
      title: 'Interactive Smartboards, Study Center & Student House Systems',
      badge: 'Experience Team',
      isPlaceholder: true
    }
  ],

  // Official Contact Channels
  channels: [
    {
      id: 'official-email',
      category: 'email',
      label: 'Official Contact Email',
      value: 'naitik.kashyap0015@gmail.com',
      actionUrl: 'mailto:naitik.kashyap0015@gmail.com',
      isConfigured: true,
      statusBadge: 'Verified Official',
      iconName: 'Mail'
    },
    {
      id: 'support-email',
      category: 'support',
      label: 'Technical Support & Helpdesk',
      value: 'naitik.kashyap0015@gmail.com',
      actionUrl: 'mailto:naitik.kashyap0015@gmail.com?subject=Veylentra%20Support%20Inquiry',
      isConfigured: true,
      statusBadge: 'Active Support',
      iconName: 'Headphones'
    },
    {
      id: 'official-website',
      category: 'website',
      label: 'Official Web Portal',
      value: typeof window !== 'undefined' ? window.location.origin : 'https://veylentra.app',
      actionUrl: typeof window !== 'undefined' ? window.location.origin : 'https://veylentra.app',
      isConfigured: true,
      statusBadge: 'Live Production',
      iconName: 'Globe'
    },
    {
      id: 'official-phone',
      category: 'phone',
      label: 'Institutional Phone Line',
      value: '[Official contact phone pending configuration]',
      isConfigured: false,
      statusBadge: 'Pending Assignment',
      iconName: 'Phone'
    },
    {
      id: 'official-social',
      category: 'social',
      label: 'Official Community & Announcements',
      value: '[Official social channels pending configuration]',
      isConfigured: false,
      statusBadge: 'Pending Assignment',
      iconName: 'Share2'
    }
  ]
};
