type LeadFavoriteButtonProps = {
  company: string;
  isFavorite: boolean;
  onToggle: () => void;
};

/**
 * Small gold bookmark with a white star, based on the supplied reference.
 * Visual-only icon; the full action name is exposed to screen readers.
 */
export function LeadFavoriteButton({
  company, isFavorite, onToggle,
}: LeadFavoriteButtonProps) {
  const action = isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos";
  return (
    <button
      type="button"
      className={"lead-favorite-button" + (isFavorite ? " is-favorite" : "")}
      aria-label={`${action}: ${company}`}
      aria-pressed={isFavorite}
      title={action}
      onClick={onToggle}
    >
      <svg viewBox="0 0 36 40" width="26" height="30" aria-hidden="true" focusable="false">
        <path
          className="lead-favorite-ribbon"
          d="M7 2h22a5 5 0 0 1 5 5v30l-16-8-16 8V7a5 5 0 0 1 5-5Z"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          className="lead-favorite-star"
          d="m18 9 3.1 6.2 6.8 1-4.95 4.85 1.17 6.85L18 24.67l-6.12 3.23 1.17-6.85-4.95-4.85 6.8-1L18 9Z"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
