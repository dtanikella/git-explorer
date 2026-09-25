/**
 * Area ID utilities — slugify and generate unique area IDs.
 * Extracted from ManageSelectionSidebar.tsx for shared use.
 */

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generates a unique area ID from a display name.
 *
 * @remarks
 * Slugifies the name and appends a 4-character random hex suffix to avoid
 * collisions. The slug is purely lowercase alphanumeric plus hyphens.
 *
 * @param name - The display name to derive the ID from.
 * @returns A unique ID string in the form `<slug>-<random>`.
 * @see {@link slugify}
 */
export function generateAreaId(name: string): string {
  const slug = slugify(name);
  const suffix = Math.random().toString(16).slice(2, 6);
  return `${slug}-${suffix}`;
}