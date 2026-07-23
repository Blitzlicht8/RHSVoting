// App version — single source of truth is package.json "version".
// Bump the version there per the MAJOR.MINOR.FIX rules in context.md.
import pkg from '../../package.json'

export const APP_VERSION: string = pkg.version
