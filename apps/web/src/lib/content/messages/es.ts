/**
 * ES message bundle for next-intl.
 *
 * Stage 2 placeholder: ES mirrors EN until Stage 4 (the translation
 * pass) replaces each value with its Spanish equivalent. Importing
 * `en` here means `/es/*` URLs render EN copy today — the locale
 * routing infrastructure is live, but the user-visible language
 * change ships with Stage 4.
 *
 * Stage 4 will replace this file with a hand-written ES dictionary
 * matching the EN shape, keyed by namespace.
 *
 * See: docs/superpowers/specs/2026-05-23-i18n-es-en-design.md §4.2, §5 D
 */
import en from "./en";

const messages = en;

export default messages;
