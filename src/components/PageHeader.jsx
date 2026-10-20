export default function PageHeader({ title, intro, children }) {
  return (
    <section className="relative overflow-hidden bg-brand text-white">
      <div aria-hidden="true" className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
      <div className="container-page relative py-12 sm:py-16">
        <h1 className="max-w-3xl text-3xl font-bold text-white sm:text-4xl">{title}</h1>
        {intro && <p className="mt-3 max-w-2xl text-lg text-white/85">{intro}</p>}
        {children}
      </div>
    </section>
  );
}
