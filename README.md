# Level-d
A platform which gamifies every aspect of life.

The independent desktop widget runs without opening the Level’d dashboard:

- `npm run build` — build the website and widget.
- `npm run widget:start` — launch the bundled periodic popup, with no Vite server.
- `npm run widget:install` — install and start its Windows login task.

The popup stays hidden until a check-in is due. Use its tray icon to set reminder
times or choose **Check in now**.
See [strict check-ins](docs/strict-checkins.md) for behavior and testing.
