const truthyValues = new Set(['1', 'true', 'yes', 'on'])

const hasFlag = (flag) => process.argv.includes(flag)
const hasTruthyEnv = (...keys) => keys.some((key) => truthyValues.has(String(process.env[key] || '').toLowerCase()))

export const isUiDevMode = hasFlag('--ui-dev-mode') || hasTruthyEnv('EON_UI_DEV_MODE', 'UI_DEV_MODE')
