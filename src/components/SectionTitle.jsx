export default function SectionTitle({ title, subtitle, action, id }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 id={id} className="text-2xl font-bold sm:text-3xl">
          <span className="mr-3 inline-block h-6 w-1.5 translate-y-0.5 rounded-full bg-accent" aria-hidden="true" />
          {title}
        </h2>
        {subtitle && <p className="mt-2 text-gray-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
