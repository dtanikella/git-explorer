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

export function generateAreaId(name: string): string {
  const slug = slugify(name);
  const suffix = Math.random().toString(16).slice(2, 6);
  return `${slug}-${suffix}`;
}