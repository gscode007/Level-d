const { app } = require('electron');
if (!process.env.LEVELD_TEST_USER_DATA) throw new Error('An isolated test profile is required.');
app.setPath('userData', process.env.LEVELD_TEST_USER_DATA);
require('../../electron/main.cjs');
