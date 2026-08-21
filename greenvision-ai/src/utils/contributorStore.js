// Demo-grade identity for the Green Champions board. A browser-generated
// contributor ID + editable display name persist in localStorage. There are no
// accounts or passwords — the backend treats this as a participation identity.
//
// Extended with organization support: contributors can optionally belong to a
// company, college, school, NGO or community group.

const ID_KEY = 'gv_contributor_id';
const NAME_KEY = 'gv_contributor_name';
const ORG_KEY = 'gv_contributor_org';
const ORG_TYPE_KEY = 'gv_contributor_org_type';

export const ORG_TYPES = [
  { id: 'individual', label: 'Individual', icon: '👤' },
  { id: 'company', label: 'Company', icon: '🏢' },
  { id: 'college', label: 'College', icon: '🎓' },
  { id: 'school', label: 'School', icon: '🏫' },
  { id: 'ngo', label: 'NGO', icon: '🌱' },
  { id: 'community', label: 'Community', icon: '🏘️' },
];

export function getContributorId() {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = `gv-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function getContributorName() {
  return localStorage.getItem(NAME_KEY) || '';
}

export function setContributorName(name) {
  localStorage.setItem(NAME_KEY, name.trim().slice(0, 80));
  return getContributorName();
}

export function getContributorOrg() {
  try {
    const raw = localStorage.getItem(ORG_KEY);
    return raw ? JSON.parse(raw) : { type: 'individual', name: '' };
  } catch {
    return { type: 'individual', name: '' };
  }
}

export function setContributorOrg(org) {
  localStorage.setItem(ORG_KEY, JSON.stringify(org));
}

export function getContributorOrgType() {
  return localStorage.getItem(ORG_TYPE_KEY) || 'individual';
}

export function setContributorOrgType(t) {
  localStorage.setItem(ORG_TYPE_KEY, t);
}
