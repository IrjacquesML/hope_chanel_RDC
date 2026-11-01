/** Rôles de l'administration. Le serveur applique les mêmes règles (server/auth.js) : ceci ne fait qu'adapter l'interface. */
export const ROLE_LABELS = {
  admin: 'Administrateur',
  editor: 'Rédacteur',
  technician: 'Technicien régie',
};

export const ROLE_INFO = {
  admin: 'Accès complet : contenus, paramètres, sauvegardes et gestion des comptes.',
  editor: 'Émissions, épisodes, catégories, programme, événements, actualités, équipe, témoignages, réseau et statistiques.',
  technician: 'Lecteur du direct, diffusion (plateformes, vMix, OBS) et statistiques.',
};

const SECTIONS = {
  editor: ['dashboard', 'stats', 'shows', 'episodes', 'categories', 'schedule', 'events', 'news', 'team', 'testimonials', 'network', 'account'],
  technician: ['dashboard', 'stats', 'settings', 'account'],
};

const SETTINGS_TABS = {
  technician: ['direct', 'diffusion'],
};

export const canSee = (user, section) => user?.role === 'admin' || Boolean(SECTIONS[user?.role]?.includes(section));
export const canSeeTab = (user, tab) => user?.role === 'admin' || Boolean(SETTINGS_TABS[user?.role]?.includes(tab));
