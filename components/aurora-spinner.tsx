/**
 * Pulsing aurora line — replaces standard spinners across the app.
 *
 * Variants:
 *   <AuroraSpinner />           → full-width loader (default)
 *   <AuroraSpinner inline />    → 80px wide for inline button states
 */
export function AuroraSpinner({
  inline = false,
  className = "",
}: {
  inline?: boolean
  className?: string
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`aurora-spinner ${inline ? "max-w-[80px]" : ""} ${className}`}
    />
  )
}
