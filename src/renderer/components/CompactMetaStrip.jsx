import { Paper, Text } from "@mantine/core";

function getValueClass(valueTone = "auto") {
  if (valueTone === "number") return "km-meta-strip__value km-meta-strip__value--number";
  if (valueTone === "compact") return "km-meta-strip__value km-meta-strip__value--compact";
  if (valueTone === "long") return "km-meta-strip__value km-meta-strip__value--long";
  return "km-meta-strip__value";
}

function MetaStripItem({ item }) {
  const label = String(item?.label ?? "").trim();
  const value = String(item?.value ?? "").trim();
  const helper = String(item?.helper ?? "").trim();
  const interactive = typeof item?.onClick === "function";

  const content = (
    <>
      <Text className="km-meta-strip__label">{label}</Text>
      <Text className={getValueClass(item?.valueTone)} title={value}>
        {value || "-"}
      </Text>
      {helper ? (
        <Text className="km-meta-strip__helper" size="sm" c="dimmed">
          {helper}
        </Text>
      ) : null}
    </>
  );

  if (interactive) {
    return (
      <button type="button" className="km-meta-strip__item is-interactive" onClick={item.onClick}>
        {content}
      </button>
    );
  }

  return <div className="km-meta-strip__item">{content}</div>;
}

export default function CompactMetaStrip({ items = [], className = "" }) {
  const visibleItems = items.filter((item) => item && (item.label || item.value || item.helper));
  if (!visibleItems.length) return null;

  return (
    <Paper className={["km-panel", "km-meta-strip", className].filter(Boolean).join(" ")}>
      <div className="km-meta-strip__grid">
        {visibleItems.map((item) => (
          <MetaStripItem key={String(item.label)} item={item} />
        ))}
      </div>
    </Paper>
  );
}
