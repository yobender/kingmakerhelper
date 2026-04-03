import { Badge, Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core";

function getMetricValueClass(value, tone = "auto") {
  const text = String(value ?? "").trim();
  if (tone === "number") return "metric-value metric-value--number";
  if (tone === "compact") return "metric-value metric-value--compact";
  if (tone === "long") return "metric-value metric-value--long";
  if (!text) return "metric-value";
  if (!/\s/.test(text) && text.length <= 6) return "metric-value metric-value--number";
  if (text.length >= 24) return "metric-value metric-value--long";
  if (text.length >= 12 || /\s/.test(text)) return "metric-value metric-value--compact";
  return "metric-value";
}

export default function MetricCard({ label, value, helper, chip, valueTone = "auto", onClick, actionLabel }) {
  const valueText = String(value ?? "").trim();
  const helperText = String(helper ?? "").trim();
  const valueClassName = getMetricValueClass(valueText, valueTone);
  const interactive = typeof onClick === "function";

  const content = (
    <Paper className={`km-panel metric-card${interactive ? " metric-card--interactive" : ""}`}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Text className="metric-label">{label}</Text>
          {chip ? (
            <Badge color="brass" variant="light">
              {chip}
            </Badge>
          ) : null}
        </Group>
        <Text className={valueClassName} title={valueText}>
          {valueText || "—"}
        </Text>
        {helperText ? (
          <Text className="metric-helper" size="sm" c="dimmed">
            {helperText}
          </Text>
        ) : null}
        {interactive && actionLabel ? <Text className="metric-action">{actionLabel}</Text> : null}
      </Stack>
    </Paper>
  );

  if (!interactive) return content;

  return (
    <UnstyledButton className="metric-card-button" onClick={onClick}>
      {content}
    </UnstyledButton>
  );
}
