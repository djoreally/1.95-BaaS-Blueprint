/**
 * Server-rendered JSON-LD structured data.
 *
 * Rendered as a plain <script type="application/ld+json"> tag in the served
 * HTML (never injected via client JS), so crawlers see it on first fetch.
 */
export default function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Record<string, unknown>[];
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
