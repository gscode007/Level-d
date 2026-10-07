import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { popupBounds } = createRequire(import.meta.url)('../../electron/popup-bounds.cjs');

for (const [width, height, x, y] of [[1920, 1080, 0, 0], [2560, 1600, -2560, 0], [1080, 1920, 1920, -200], [3440, 1440, 0, 0]]) {
  test(`popup is centered and matches ${width}×${height} monitor proportions`, () => {
    const workArea = { x, y, width, height: height - 48 };
    const popup = popupBounds({ bounds: { x, y, width, height }, workArea });
    assert.ok(Math.abs(popup.width / popup.height - width / height) < 0.005);
    assert.ok(Math.abs(popup.x + popup.width / 2 - x - width / 2) <= 1);
    assert.ok(Math.abs(popup.y + popup.height / 2 - y - workArea.height / 2) <= 1);
    assert.ok(popup.width < width && popup.height < workArea.height);
  });
}
