/**
 * Continuous, low-contrast aurora behind public pages.
 * Four decorative layers; CSS animations only, with no network, canvas,
 * image asset, random values or event listeners.
 */
export function AuroraBackdrop() {
  return (
    <div className="jl-aurora" aria-hidden="true" data-ambient="aurora">
      <span className="jl-aurora-veil jl-aurora-veil--rose" />
      <span className="jl-aurora-veil jl-aurora-veil--violet" />
      <span className="jl-aurora-veil jl-aurora-veil--plum" />
      <span className="jl-aurora-veil jl-aurora-veil--blue" />
      <span className="jl-aurora-haze" />
    </div>
  );
}
