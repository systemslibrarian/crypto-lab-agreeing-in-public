/**
 * Known WCAG 1.4.11 non-text-contrast findings in this lab, captured through
 * the gate's own path so the baseline and the check cannot disagree.
 *
 * THIS FILE IS A TO-DO LIST, NOT A SET OF EXEMPTIONS. The gate ratchets on it:
 *   - a finding NOT listed here fails the run, so a regression cannot land;
 *   - a listed finding whose ratio gets WORSE fails, so the list cannot rot;
 *   - a listed finding that no longer appears ALSO fails, so a fixed entry must
 *     be deleted and the file can only shrink toward empty.
 * The last rule is what stops an allowlist becoming a permanent exemption.
 *
 * IT IS EMPTY, AND THAT IS THE POINT — the terminal state of the ratchet, not
 * an unrun check. This lab was authored against the oracle rather than
 * baselined after it: every control draws its boundary from `--border-strong`
 * (3.84:1 against the card it sits on) or from an accent fill (9.88:1), and
 * `--border` at 1.55:1 is used only for dividers and card edges that no reader
 * has to find or operate. The two entries most of this fleet carries for the
 * shared top bar are absent because this bar's brand mark and nav underline
 * are painted from `--accent`, not from a decorative border.
 */
export const NONTEXT_BASELINE: Record<
  string,
  { ratio: number; required: number; unverified: boolean }
> = {}
