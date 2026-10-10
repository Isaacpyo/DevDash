import { SearchForm } from "@/components/search-form";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <p className="text-sm font-medium text-accent-ink">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">
        We couldn&apos;t find that GitHub user
      </h1>
      <p className="mt-2 text-sm text-ink-secondary">
        Check the spelling, or search for someone else.
      </p>
      <div className="mt-8 text-left">
        <SearchForm />
      </div>
    </div>
  );
}
