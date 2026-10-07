// Match the monitor's aspect ratio while leaving room around the popup.
function popupBounds(display) {
  const { bounds, workArea } = display;
  const scale = Math.min(workArea.width * 0.72 / bounds.width, workArea.height * 0.72 / bounds.height);
  const width = Math.round(bounds.width * scale);
  const height = Math.round(bounds.height * scale);
  return { width, height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2) };
}
module.exports = { popupBounds };
