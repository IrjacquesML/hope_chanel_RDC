/** Logo officiel Hope Channel RDC (bannière, fond bleu intégré : lisible sur fond clair comme foncé). */
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
  return (
    <img
      src="/logo-hope-channel-rdc.webp"
      alt="Hope Channel RDC"
      width="602"
      height="112"
      decoding="async"
      className={`${h} w-auto rounded-sm ${className}`}
    />
  );
}
