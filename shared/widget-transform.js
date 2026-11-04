export function resolveWidgetTransform(config) {
  if (config.widgetTransformPreset !== 'custom') return null;
  const finite = (key, fallback) => Number.isFinite(Number(config[key])) ? Number(config[key]) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  return { x: clamp(finite('widgetOffsetX', 0), -50, 50), y: clamp(finite('widgetOffsetY', 0), -50, 50), scale: clamp(finite('widgetScale', 1), 0.25, 2), rotation: clamp(finite('widgetRotation', 0), -180, 180), opacity: clamp(finite('widgetOpacity', 1), 0.1, 1) };
}

export function applyWidgetTransform(element, config) {
  const transform = resolveWidgetTransform(config);
  if (!transform) { element.style.transform = ''; element.style.opacity = ''; return; }
  element.style.transform = `translate(${transform.x}vw, ${transform.y}vh) scale(${transform.scale}) rotate(${transform.rotation}deg)`;
  element.style.opacity = String(transform.opacity);
}
