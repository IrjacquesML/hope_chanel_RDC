import { settings, siteName } from '../siteSettings';

const DEFAULT_LOGO = '/logo-hope-channel-rdc.webp';

/** Logo du site (modifiable dans Paramètres → Identité & logo). Le logo d'origine a son fond bleu intégré. */
export default function Logo({ className = '', size = 'md', onDark = false }) {
  const h = { sm: 'h-8', md: 'h-[30px] min-[360px]:h-9 sm:h-10 xl:h-11', lg: 'h-12' }[size];
  if (onDark) {
    // Sur fond foncé : plaque blanche, pour que la partie blanche du logo ne paraisse pas découpée
    return (
      <span className={`inline-block rounded-lg bg-white p-1.5 ${className}`}>
        <Logo size={size} />
      </span>
    );
  }
  const src = settings.site?.logo || DEFAULT_LOGO;
  return (
    <img
      src={src}
      alt={siteName()}
      // Dimensions connues seulement pour le logo d'origine (évite un décalage au chargement)
      {...(src === DEFAULT_LOGO ? { width: 602, height: 112 } : {})}
      decoding="async"
      className={`${h} w-auto max-w-[220px] rounded-sm object-contain sm:max-w-[280px] ${className}`}
    />
  );
}
