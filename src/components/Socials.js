import { Facebook, Instagram, LinkedIn, Telegram, TikTok, WhatsApp, XIcon, YouTube } from './Icons';

/** Réseaux sociaux gérés depuis l'administration (Paramètres → Réseaux sociaux), dans l'ordre d'affichage. */
export const SOCIALS = [
  { key: 'youtube', label: 'YouTube', Icon: YouTube },
  { key: 'facebook', label: 'Facebook', Icon: Facebook },
  { key: 'tiktok', label: 'TikTok', Icon: TikTok },
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'x', label: 'X', Icon: XIcon },
  { key: 'whatsapp', label: 'WhatsApp', Icon: WhatsApp },
  { key: 'telegram', label: 'Telegram', Icon: Telegram },
  { key: 'linkedin', label: 'LinkedIn', Icon: LinkedIn },
];

/** Uniquement les réseaux renseignés : un lien vide n'affiche pas d'icône. */
export const activeSocials = (social = {}) => SOCIALS.filter(({ key }) => social[key]?.trim());
