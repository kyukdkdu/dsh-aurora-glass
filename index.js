/**
 * dsh-aurora-glass — host half.
 *
 * The theme lives entirely in the browser half (`./client`, declared through
 * `dsh.client`). The host half exists only so the package can be a Loader
 * entry (a bundle patch row), and it deliberately does nothing: no services,
 * no web routes, no filesystem writes, nothing that could fail and take the
 * application down with it.
 */

export const name = 'dsh-aurora-glass';

export function apply() {
  /* intentionally empty — see the module comment above */
}
